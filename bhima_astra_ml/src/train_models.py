"""
BHIMA ASTRA — Upgraded Model Training Pipeline v2
Models: Income (RF+XGB) | Disruption (Forecast+Realtime) | Premium | Fraud (Tuned)
"""

import pandas as pd
import numpy as np
import joblib
import os
import sys
import warnings
warnings.filterwarnings("ignore")

sys.path.insert(0, "src")

from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import Ridge
from sklearn.model_selection import train_test_split, RandomizedSearchCV
from sklearn.metrics import (
    mean_absolute_error, r2_score,
    accuracy_score, f1_score,
    classification_report, confusion_matrix,
    precision_recall_curve, average_precision_score,
)
from sklearn.preprocessing import StandardScaler
from xgboost import XGBClassifier, XGBRegressor

from model_features import (
    build_income_features,
    build_disruption_features,
    build_disruption_realtime_features,
    build_fraud_features,
)

os.makedirs("models", exist_ok=True)

# ══════════════════════════════════════════════════════════
# HELPER
# ══════════════════════════════════════════════════════════

def print_section(title):
    print("\n" + "═" * 60)
    print(f"  {title}")
    print("═" * 60)


def find_best_threshold(y_true, y_prob, beta=1.0):
    """
    Find threshold that maximises F-beta score on precision-recall curve.
    beta=1 → equal weight. beta=2 → recall-focused (better for fraud).
    """
    precision, recall, thresholds = precision_recall_curve(y_true, y_prob)
    # Avoid division by zero
    denom = (beta**2 * precision + recall)
    denom = np.where(denom == 0, 1e-9, denom)
    fbeta  = (1 + beta**2) * precision * recall / denom
    best_idx = np.argmax(fbeta[:-1])
    best_thr = thresholds[best_idx]
    print(f"  Best threshold : {best_thr:.4f}  "
          f"(P={precision[best_idx]:.3f}  R={recall[best_idx]:.3f}  "
          f"F{beta}={fbeta[best_idx]:.3f})")
    return float(best_thr)


# ══════════════════════════════════════════════════════════
# 1 — INCOME MODEL  (RF + XGBoost, pick best)
# ══════════════════════════════════════════════════════════

def train_income_model(income_df):
    print_section("1. INCOME PREDICTION MODEL  (RF vs XGBoost)")

    X, y = build_income_features(income_df)
    X    = X.select_dtypes(include=[np.number]).fillna(0)

    print(f"  Features : {X.shape[1]}   Samples : {X.shape[0]}")
    print(f"  Target   : ₹{y.min():.0f} – ₹{y.max():.0f}")

    X_tr, X_te, y_tr, y_te = train_test_split(
        X, y, test_size=0.20, random_state=42)

    # ── Random Forest ──────────────────────────────────────
    rf = RandomForestRegressor(
        n_estimators=200, max_depth=15,
        min_samples_leaf=5, n_jobs=-1, random_state=42)
    rf.fit(X_tr, y_tr)
    rf_pred = rf.predict(X_te)
    rf_r2   = r2_score(y_te, rf_pred)
    rf_mae  = mean_absolute_error(y_te, rf_pred)
    print(f"\n  RandomForest  → MAE: ₹{rf_mae:.2f}  R²: {rf_r2:.4f}")

    # ── XGBoost Regressor ──────────────────────────────────
    param_dist_xgb = {
        "n_estimators":    [200, 300, 500],
        "max_depth":       [4, 6, 8],
        "learning_rate":   [0.03, 0.05, 0.10],
        "subsample":       [0.7, 0.8, 1.0],
        "colsample_bytree":[0.7, 0.8, 1.0],
    }
    xgb_base = XGBRegressor(
        tree_method="hist", random_state=42,
        n_jobs=-1, verbosity=0)
    xgb_search = RandomizedSearchCV(
        xgb_base, param_dist_xgb, n_iter=12,
        scoring="r2", cv=3, random_state=42,
        n_jobs=-1, verbose=0)
    xgb_search.fit(X_tr, y_tr)
    xgb      = xgb_search.best_estimator_
    xgb_pred = xgb.predict(X_te)
    xgb_r2   = r2_score(y_te, xgb_pred)
    xgb_mae  = mean_absolute_error(y_te, xgb_pred)
    print(f"  XGBoost       → MAE: ₹{xgb_mae:.2f}  R²: {xgb_r2:.4f}")
    print(f"  Best XGB params: {xgb_search.best_params_}")

    # ── Pick winner ────────────────────────────────────────
    if xgb_r2 >= rf_r2:
        best_model = xgb
        winner     = "XGBoost"
        best_r2    = xgb_r2
        best_mae   = xgb_mae
    else:
        best_model = rf
        winner     = "RandomForest"
        best_r2    = rf_r2
        best_mae   = rf_mae

    print(f"\n  ✅ Winner: {winner}  MAE=₹{best_mae:.2f}  R²={best_r2:.4f}")

    # Feature importance (works for both)
    imp = pd.Series(
        best_model.feature_importances_, index=X.columns
    ).sort_values(ascending=False).head(10)
    print(f"\n  Top 10 Features:\n{imp.to_string()}")

    joblib.dump(best_model,       "models/income_model.pkl")
    joblib.dump(X.columns.tolist(),"models/income_features.pkl")
    print("\n  💾 models/income_model.pkl")
    return best_model


# ══════════════════════════════════════════════════════════
# 2A — DISRUPTION FORECAST MODEL  (historical/behavioral)
# ══════════════════════════════════════════════════════════

def train_disruption_forecast_model(disruption_df):
    print_section("2A. DISRUPTION FORECAST MODEL  (context-based)")

    X, y = build_disruption_features(disruption_df)
    X    = X.select_dtypes(include=[np.number]).fillna(0)

    trigger_check = [c for c in X.columns if c in [
        "rainfall","AQI","temperature","flood_alert",
        "platform_outage","zone_shutdown","curfew_flag",
        "strike_flag","composite_score","R_norm"
    ]]
    if trigger_check:
        print(f"  ⚠️  Trigger leak: {trigger_check}")
    else:
        print("  ✅ No trigger leak")

    print(f"  Features : {X.shape[1]}   Class balance: "
          f"{y.value_counts().to_dict()}")

    X_tr, X_te, y_tr, y_te = train_test_split(
        X, y, test_size=0.20, random_state=42, stratify=y)

    pos   = (y_tr==1).sum(); neg = (y_tr==0).sum()
    ratio = neg / pos if pos > 0 else 1

    model = XGBClassifier(
        n_estimators=300, max_depth=6, learning_rate=0.05,
        scale_pos_weight=ratio, subsample=0.8,
        colsample_bytree=0.8, use_label_encoder=False,
        eval_metric="logloss", random_state=42, n_jobs=-1)
    model.fit(X_tr, y_tr,
              eval_set=[(X_te, y_te)], verbose=False)

    y_prob = model.predict_proba(X_te)[:, 1]
    thr    = find_best_threshold(y_te, y_prob, beta=1.0)
    y_pred = (y_prob >= thr).astype(int)

    print(f"\n  Accuracy : {accuracy_score(y_te,y_pred):.4f}")
    print(f"  F1 Score : {f1_score(y_te,y_pred,average='weighted'):.4f}")
    print(classification_report(y_te, y_pred, digits=3))
    print(f"  CM:\n{confusion_matrix(y_te,y_pred)}")

    joblib.dump(model,               "models/disruption_forecast_model.pkl")
    joblib.dump(X.columns.tolist(),  "models/disruption_forecast_features.pkl")
    joblib.dump(thr,                 "models/disruption_forecast_threshold.pkl")
    print("\n  💾 models/disruption_forecast_model.pkl")
    return model, thr


# ══════════════════════════════════════════════════════════
# 2B — DISRUPTION REALTIME MODEL  (same-day triggers)
# ══════════════════════════════════════════════════════════

def train_disruption_realtime_model(disruption_df):
    print_section("2B. DISRUPTION REALTIME MODEL  (trigger-based)")

    X, y = build_disruption_realtime_features(disruption_df)
    X    = X.select_dtypes(include=[np.number]).fillna(0)

    print(f"  Features : {X.shape[1]}   Class balance: "
          f"{y.value_counts().to_dict()}")

    X_tr, X_te, y_tr, y_te = train_test_split(
        X, y, test_size=0.20, random_state=42, stratify=y)

    pos   = (y_tr==1).sum(); neg = (y_tr==0).sum()
    ratio = neg / pos if pos > 0 else 1

    model = XGBClassifier(
        n_estimators=200, max_depth=5, learning_rate=0.08,
        scale_pos_weight=ratio, subsample=0.9,
        colsample_bytree=0.9, use_label_encoder=False,
        eval_metric="logloss", random_state=42, n_jobs=-1)
    model.fit(X_tr, y_tr,
              eval_set=[(X_te, y_te)], verbose=False)

    y_prob = model.predict_proba(X_te)[:, 1]
    thr    = find_best_threshold(y_te, y_prob, beta=1.0)
    y_pred = (y_prob >= thr).astype(int)

    print(f"\n  Accuracy : {accuracy_score(y_te,y_pred):.4f}")
    print(f"  F1 Score : {f1_score(y_te,y_pred,average='weighted'):.4f}")
    print(classification_report(y_te, y_pred, digits=3))

    imp = pd.Series(
        model.feature_importances_, index=X.columns
    ).sort_values(ascending=False).head(10)
    print(f"\n  Top Features:\n{imp.to_string()}")

    joblib.dump(model,               "models/disruption_realtime_model.pkl")
    joblib.dump(X.columns.tolist(),  "models/disruption_realtime_features.pkl")
    joblib.dump(thr,                 "models/disruption_realtime_threshold.pkl")
    print("\n  💾 models/disruption_realtime_model.pkl")
    return model, thr


# ══════════════════════════════════════════════════════════
# 3 — PREMIUM MODEL
# ══════════════════════════════════════════════════════════

def train_premium_model(income_df):
    print_section("3. PREMIUM CALCULATION MODEL  (Ridge)")

    agg_cols = {
        "actual_income":   "mean",
        "income_loss":     "mean",
        "disruption_flag": "mean",
        "composite_score": "mean",
        "rainfall":        "mean",
        "AQI":             "mean",
        "experience_level":"first",
        "shift_hours":     "first",
        "fraud_risk_score":"first",
        "kyc_verified":    "first",
        "bank_verified":   "first",
    }
    available = {k:v for k,v in agg_cols.items() if k in income_df.columns}
    agg = income_df.groupby("worker_id").agg(
        **{k:(k,v) for k,v in available.items()}
    ).reset_index()

    def assign_tier(row):
        income = row.get("actual_income", 1000)
        risk   = row.get("disruption_flag", 0.3)
        loss   = income * risk * 7 * 0.30
        raw    = loss * 1.35
        if raw <= 60 or income < 900:   return 49
        elif raw <= 90 or income < 1300: return 79
        else:                            return 119

    agg["predicted_loss"]      = (
        agg.get("income_loss", 0) *
        agg.get("disruption_flag", 0.3) * 7 * 0.30
    )
    agg["weekly_premium_target"] = agg.apply(assign_tier, axis=1)

    feat_cols = [c for c in agg.columns
                 if c not in ["worker_id","weekly_premium_target","predicted_loss"]]
    X = agg[feat_cols].fillna(0)
    y = agg["weekly_premium_target"]

    print(f"  Workers : {len(agg)}  Features : {X.shape[1]}")
    print(f"  Premium range : ₹{y.min():.0f} – ₹{y.max():.0f}")
    print(f"  Plan distribution:\n{y.value_counts().to_string()}")

    X_tr, X_te, y_tr, y_te = train_test_split(
        X, y, test_size=0.20, random_state=42)

    scaler   = StandardScaler()
    X_tr_sc  = scaler.fit_transform(X_tr)
    X_te_sc  = scaler.transform(X_te)

    model  = Ridge(alpha=1.0)
    model.fit(X_tr_sc, y_tr)
    y_pred = model.predict(X_te_sc)

    print(f"\n  ✅ MAE: ₹{mean_absolute_error(y_te,y_pred):.2f}  "
          f"R²: {r2_score(y_te,y_pred):.4f}")

    coef = pd.Series(model.coef_, index=feat_cols).sort_values(
        key=abs, ascending=False)
    print(f"\n  Coefficients:\n{coef.to_string()}")

    joblib.dump(model,     "models/premium_model.pkl")
    joblib.dump(scaler,    "models/premium_scaler.pkl")
    joblib.dump(feat_cols, "models/premium_features.pkl")
    print("\n  💾 models/premium_model.pkl")
    return model, scaler


# ══════════════════════════════════════════════════════════
# 4 — FRAUD MODEL  (Tuned XGBoost + dynamic threshold)
# ══════════════════════════════════════════════════════════
def train_fraud_model(fraud_df):
    print_section("4. FRAUD DETECTION MODEL  (Calibrated XGBoost)")

    X, y = build_fraud_features(fraud_df)
    X    = X.select_dtypes(include=[np.number]).fillna(0)

    print(f"  Features : {X.shape[1]}   Fraud rate: {y.mean()*100:.1f}%")
    print(f"  Class balance: {y.value_counts().to_dict()}")

    X_tr, X_te, y_tr, y_te = train_test_split(
        X, y, test_size=0.20, random_state=42,
        stratify=y if y.sum() > 10 else None)

    pos   = (y_tr==1).sum(); neg = (y_tr==0).sum()
    ratio = neg / pos if pos > 0 else 1

    param_dist = {
        "n_estimators":     [200, 300, 500],
        "max_depth":        [3, 4, 5, 6],
        "learning_rate":    [0.01, 0.03, 0.05, 0.10],
        "subsample":        [0.6, 0.7, 0.8],
        "colsample_bytree": [0.6, 0.7, 0.8],
        "min_child_weight": [1, 3, 5],
        "gamma":            [0, 0.1, 0.3],
    }
    base_model = XGBClassifier(
        scale_pos_weight=ratio,
        use_label_encoder=False,
        eval_metric="aucpr",
        random_state=42, n_jobs=-1, verbosity=0)

    search = RandomizedSearchCV(
        base_model, param_dist, n_iter=20,
        scoring="average_precision",   # ← optimise for PR-AUC not F1
        cv=3, random_state=42, n_jobs=-1, verbose=0)
    search.fit(X_tr, y_tr)

    model  = search.best_estimator_
    print(f"  Best params: {search.best_params_}")

    # ── Evaluate with raw probabilities (no static threshold) ──
    y_prob = model.predict_proba(X_te)[:, 1]
    ap     = average_precision_score(y_te, y_prob)
    print(f"\n  ✅ Average Precision (PR-AUC): {ap:.4f}")
    print(f"  Score distribution on test set:")
    print(f"    P25={np.percentile(y_prob,25):.4f}  "
          f"P50={np.percentile(y_prob,50):.4f}  "
          f"P75={np.percentile(y_prob,75):.4f}  "
          f"P90={np.percentile(y_prob,90):.4f}  "
          f"P95={np.percentile(y_prob,95):.4f}")

    # ── Save model + probability distribution for calibration ──
    joblib.dump(model,              "models/fraud_model.pkl")
    joblib.dump(X.columns.tolist(), "models/fraud_features.pkl")
    # Save training probability array for calibration baseline
    joblib.dump(y_prob,             "models/fraud_prob_distribution.pkl")

    imp = pd.Series(
        model.feature_importances_, index=X.columns
    ).sort_values(ascending=False).head(10)
    print(f"\n  Top 10 Features:\n{imp.to_string()}")

    print("\n  💾 models/fraud_model.pkl")
    print("  💾 models/fraud_prob_distribution.pkl")

    # NOTE: No static threshold saved — decision_engine handles this
    return model


# ══════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════

def run_all_training():
    print("\n🚀 BHIMA ASTRA — Upgraded ML Training Pipeline v2")

    income_df     = pd.read_csv("data/features/income.csv")
    disruption_df = pd.read_csv("data/features/disruption.csv")
    fraud_df      = pd.read_csv("data/features/fraud.csv")

    train_income_model(income_df)
    train_disruption_forecast_model(disruption_df)
    train_disruption_realtime_model(disruption_df)
    train_premium_model(income_df)
    fraud_model = train_fraud_model(fraud_df)

    # ── Build calibration distribution ─────────────────────
    print("\n[Post-training] Building adaptive calibration...")
    from decision_engine import build_calibration_distribution
    from model_features import build_fraud_features  # ✅ FIX 1: Import this

    fraud_features = joblib.load("models/fraud_features.pkl")
    graph_scores   = pd.DataFrame()   # empty if graph not yet built
    if os.path.exists("data/processed/graph_scores.csv"):
        graph_scores = pd.read_csv("data/processed/graph_scores.csv")

    # ✅ FIX 2: Create the engineered features first before calibration
    X_fraud_enriched, _ = build_fraud_features(fraud_df)
    
    # decision_engine needs 'worker_id' to map graph scores, so add it back
    if "worker_id" in fraud_df.columns:
        X_fraud_enriched["worker_id"] = fraud_df["worker_id"].values

    # ✅ FIX 3: Pass X_fraud_enriched instead of raw fraud_df
    build_calibration_distribution(
        fraud_df        = X_fraud_enriched,
        fraud_model     = fraud_model,
        fraud_features  = fraud_features,
        graph_scores_df = graph_scores,
    )

    print("\n" + "═" * 60)
    print("  ✅ ALL MODELS + CALIBRATION SAVED")
    print("═" * 60)


if __name__ == "__main__":
    run_all_training()