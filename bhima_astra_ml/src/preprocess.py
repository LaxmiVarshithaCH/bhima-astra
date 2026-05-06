import pandas as pd
import numpy as np
from sklearn.preprocessing import LabelEncoder, StandardScaler
import joblib
import os

def preprocess_workers(df):
    """
    Returns TWO datasets:
    - df_ml    : encoded, ID columns dropped → for model training
    - df_graph : raw identity columns kept   → for graph building
    """
    df = df.copy()

    # ── Graph dataset: keep raw identity signals ───────────
    graph_cols = ["worker_id", "device_id", "upi_id",
                  "bank_ifsc", "geo_zone_id"]
    df_graph = df[[c for c in graph_cols if c in df.columns]].copy()

    # ── ML dataset: drop identity columns ─────────────────
    drop_for_ml = ["worker_name", "device_id", "upi_id", "bank_ifsc"]
    df_ml = df.drop(
        columns=[c for c in drop_for_ml if c in df.columns]
    ).copy()

    # Fill nulls
    df_ml["experience_level"] = df_ml["experience_level"].fillna(0)
    df_ml["fraud_risk_score"] = df_ml["fraud_risk_score"].fillna(0.1)
    df_ml["kyc_verified"]     = df_ml["kyc_verified"].fillna(0)
    df_ml["bank_verified"]    = df_ml["bank_verified"].fillna(0)

    # Encode categoricals (ML dataset only)
    cat_cols = ["platform", "city", "geo_zone_id",
                "vehicle_type", "employment_type",
                "payment_verified_status"]
    encoders = {}
    for col in cat_cols:
        if col in df_ml.columns:
            le = LabelEncoder()
            df_ml[col] = le.fit_transform(df_ml[col].astype(str))
            encoders[col] = le

    return df_ml, df_graph, encoders



def preprocess_daily_ops(df):
    """Clean and engineer features from daily_operations.csv"""
    df = df.copy()

    # Parse date
    if "date" in df.columns:
        df["date"] = pd.to_datetime(df["date"])
        df["month"] = df["date"].dt.month
        df["week"]  = df["date"].dt.isocalendar().week.astype(int)

    # Drop non-ML columns
    drop_cols = ["log_id", "date", "AQI_category",
                 "rainfall_category", "visibility"]
    df.drop(columns=[c for c in drop_cols if c in df.columns], inplace=True)

    # Fill nulls
    num_cols = df.select_dtypes(include=[np.number]).columns
    df[num_cols] = df[num_cols].fillna(df[num_cols].median())

    # Encode remaining categoricals
    cat_cols = df.select_dtypes(include=["object"]).columns.tolist()
    encoders = {}
    for col in cat_cols:
        le = LabelEncoder()
        df[col] = le.fit_transform(df[col].astype(str))
        encoders[col] = le

    return df, encoders


def preprocess_policy_claims(df):
    """Clean policy_claims.csv for fraud + payout models"""
    df = df.copy()

    # Parse dates
    date_cols = ["activation_date", "last_active_date",
                 "claim_timestamp", "payout_timestamp"]
    for col in date_cols:
        if col in df.columns:
            df[col] = pd.to_datetime(df[col], errors="coerce")

    # Days active feature
    if "activation_date" in df.columns and "last_active_date" in df.columns:
        df["days_active"] = (
            df["last_active_date"] - df["activation_date"]
        ).dt.days.fillna(0)

    # Fill nulls
    df["fraud_score"]             = df["fraud_score"].fillna(0.0)
    df["fraud_flag"]              = df["fraud_flag"].fillna(0).astype(int)
    df["gps_tower_delta"]         = pd.to_numeric(
        df["gps_tower_delta"], errors="coerce").fillna(0)
    df["accelerometer_variance"]  = pd.to_numeric(
        df["accelerometer_variance"], errors="coerce").fillna(0)
    df["claim_response_time_sec"] = pd.to_numeric(
        df["claim_response_time_sec"], errors="coerce").fillna(999)
    df["app_interaction_count"]   = pd.to_numeric(
        df["app_interaction_count"], errors="coerce").fillna(0)
    df["payout_amount"]           = pd.to_numeric(
        df["payout_amount"], errors="coerce").fillna(0)
    df["income_loss"]             = pd.to_numeric(
        df["income_loss"], errors="coerce").fillna(0)

    # Encode payout_status as numeric target
    payout_map = {
        "paid": 0, "pending": 1, "rejected": 2,
        "under_review": 3, "no_claim": 4
    }
    if "payout_status" in df.columns:
        df["payout_status_encoded"] = (
            df["payout_status"].map(payout_map).fillna(4).astype(int))

    # Drop non-ML columns
    drop_cols = ["claim_id", "policy_id", "activation_date",
                 "last_active_date", "claim_timestamp",
                 "payout_timestamp", "cell_tower_id",
                 "fraud_reason", "payout_status",
                 "trigger_type", "trigger_level"]
    df.drop(columns=[c for c in drop_cols if c in df.columns], inplace=True)

    # Encode remaining object cols
    cat_cols = df.select_dtypes(include=["object"]).columns.tolist()
    encoders = {}
    for col in cat_cols:
        le = LabelEncoder()
        df[col] = le.fit_transform(df[col].astype(str))
        encoders[col] = le

    # Final fill
    num_cols = df.select_dtypes(include=[np.number]).columns
    df[num_cols] = df[num_cols].fillna(0)

    return df, encoders



def run_all_preprocessing():
    from load_data import load_datasets

    print("Loading datasets...")
    workers, daily_ops, policy_claims = load_datasets()

    print("Preprocessing workers...")
    # ✅ Now returns 3 values
    workers_ml, workers_graph, w_enc = preprocess_workers(workers)

    print("Preprocessing daily operations...")
    daily_clean, d_enc = preprocess_daily_ops(daily_ops)

    print("Preprocessing policy & claims...")
    claims_clean, c_enc = preprocess_policy_claims(policy_claims)

    os.makedirs("data/processed", exist_ok=True)
    # ✅ Save both worker outputs
    workers_ml.to_csv("data/processed/workers_clean.csv",    index=False)
    workers_graph.to_csv("data/processed/workers_graph.csv", index=False)
    daily_clean.to_csv("data/processed/daily_clean.csv",     index=False)
    claims_clean.to_csv("data/processed/claims_clean.csv",   index=False)

    os.makedirs("models", exist_ok=True)
    joblib.dump(w_enc, "models/workers_encoders.pkl")
    joblib.dump(d_enc, "models/daily_encoders.pkl")
    joblib.dump(c_enc, "models/claims_encoders.pkl")

    print(f"\n✅ Preprocessing complete!")
    print(f"   workers_clean : {workers_ml.shape}")
    print(f"   workers_graph : {workers_graph.shape}")
    print(f"   daily_clean   : {daily_clean.shape}")
    print(f"   claims_clean  : {claims_clean.shape}")

    return workers_ml, workers_graph, daily_clean, claims_clean

if __name__ == "__main__":
    run_all_preprocessing()