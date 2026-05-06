"""
BHIMA ASTRA — Fraud Pipeline Orchestrator
Runs all 4 stages in sequence.
FastAPI-compatible: accepts dict, returns dict.
"""

import logging
import pandas as pd
import numpy as np
logger = logging.getLogger(__name__)
# --- ADD THIS BELOW EXISTING IMPORTS ---
try:
    from explainability import BhimaExplainer
    explainer = BhimaExplainer()
except ImportError:
    explainer = None
    logger.warning("SHAP Explainer not available.")
from fraud_rules    import run_rule_engine
from behavior_model import compute_behavior_score
from decision_engine import make_fraud_decision, load_calibration


logger = logging.getLogger("bhima.pipeline")


def run_fraud_pipeline(
    features:        dict,
    worker_id:       int           = 0,
    graph_scores_df: pd.DataFrame  = None,
    tabular_model                  = None,
    fraud_features:  list          = None,
) -> dict:
    """
    4-Stage Fraud Detection Pipeline.

    Stage 1: Rule engine      (deterministic, zero ML cost)
    Stage 2: Behavior model   (LSTM-style behavioral score)
    Stage 3: Graph signals    (cluster score + size)
    Stage 4: Decision engine  (adaptive percentile)

    Args:
        features        : raw claim features dict
        worker_id       : for graph lookup + traceability
        graph_scores_df : pre-loaded graph_scores.csv
        tabular_model   : loaded fraud XGBoost model
        fraud_features  : feature column list for tabular model

    Returns:
        Combined result dict with all scores + lifecycle action
    """

    load_calibration()

    # ══════════════════════════════════════════════════════
    # STAGE 1 — Rule Engine
    # ══════════════════════════════════════════════════════
    logger.info(f"[Pipeline] worker={worker_id} — Stage 1: Rules")
    rule_output = run_rule_engine(features)

    rule_score    = rule_output["rule_score"]
    rule_flags    = rule_output["rule_flags"]
    rule_decision = rule_output["rule_decision"]

    # Fast-path: if PASS and no flags → skip heavy models
    # (Only skip tabular — still run behavior for completeness)
    skip_heavy = (rule_decision == "PASS" and len(rule_flags) == 0)

    # ══════════════════════════════════════════════════════
    # STAGE 2 — Behavioral Model
    # ══════════════════════════════════════════════════════
    logger.info(f"[Pipeline] worker={worker_id} — Stage 2: Behavior")
    behavior_score = compute_behavior_score(features)

    # ══════════════════════════════════════════════════════
    # STAGE 3 — Graph Signals
    # ══════════════════════════════════════════════════════
    logger.info(f"[Pipeline] worker={worker_id} — Stage 3: Graph")
    cluster_score = 0.0
    cluster_size  = 1

    if graph_scores_df is not None and not graph_scores_df.empty:
        wrow = graph_scores_df[
            graph_scores_df["worker_id"] == worker_id]
        if not wrow.empty:
            cluster_score = float(
                wrow["fraud_cluster_score"].iloc[0])
            cluster_size  = int(
                wrow["cluster_size"].iloc[0])

    # ══════════════════════════════════════════════════════
    # STAGE 4 — Tabular Model + Decision Engine
    # ══════════════════════════════════════════════════════
    logger.info(f"[Pipeline] worker={worker_id} — Stage 4: Decision")

    shap_explanation = [] # Default empty list
    
    # Tabular probability
    if tabular_model is not None and fraud_features is not None:
        row = pd.DataFrame([features]).reindex(columns=fraud_features, fill_value=0)
        row = row.select_dtypes(include=[np.number]).fillna(0)
        tabular_prob = float(tabular_model.predict_proba(row)[0][1])
        
        # 🔥 SHAP INTEGRATION: Trigger only if prob > 0.40
        # 🔥 NEW: Trigger SHAP only if probability is suspiciously high
        if tabular_prob > 0.40 and explainer is not None:
            try:
                # 🔥 FIX 1: Pass the formatted row to SHAP, not the raw features dict
                shap_input = row.to_dict(orient="records")[0]
                shap_out = explainer.explain_single_claim(shap_input)
                shap_explanation = shap_out.get("top_drivers", [])
            except Exception as e:
                logger.warning(f"SHAP explanation failed: {e}")
    else:
        # Fallback: use rule + behavior as proxy
        tabular_prob = float(np.clip(rule_score * 0.6 + behavior_score * 0.4, 0, 1))
        logger.warning(
            "[Pipeline] Tabular model not provided — "
            "using rule+behavior proxy")

    # Final adaptive decision
    decision = make_fraud_decision(
        tabular_prob   = tabular_prob,
        cluster_score  = cluster_score,
        cluster_size   = cluster_size,
        behavior_score = behavior_score,
        rule_score     = rule_score,
        worker_id      = worker_id,
        features       = features,
    )

    # ══════════════════════════════════════════════════════
    # COMBINE AND RETURN
    # ══════════════════════════════════════════════════════
    if skip_heavy:
        logger.info("[Pipeline] Fast-path: skipping heavy models")
        # Overwrite the decision variable with zeroed ML scores
        decision = make_fraud_decision(
            tabular_prob   = 0.0,
            cluster_score  = cluster_score,
            cluster_size   = cluster_size,
            behavior_score = behavior_score,
            rule_score     = rule_score,
            worker_id      = worker_id,
            features       = features,
        )

    result = {
        # Stage outputs
        "stage1_rule_flags":    rule_flags,
        "stage1_rule_decision": rule_decision,
        "stage2_behavior_score":behavior_score,
        "stage3_cluster_score": cluster_score,
        "stage3_cluster_size":  cluster_size,
        "shap_explanation":     shap_explanation, # 🔥 SHAP ADDED HERE
        # Final decision (from Stage 4)
        **decision,
    }

    logger.info(
        f"[Pipeline] COMPLETE worker={worker_id}  "
        f"→ {decision['decision']}  "
        f"payout={decision.get('payout_status', 'UNKNOWN')}")

    return result

    


if __name__ == "__main__":
    import joblib
    import os

    # Load models for test
    tabular_model   = joblib.load("models/fraud_model.pkl") \
        if os.path.exists("models/fraud_model.pkl") else None
    fraud_features  = joblib.load("models/fraud_features.pkl") \
        if os.path.exists("models/fraud_features.pkl") else None
    graph_scores_df = pd.read_csv("data/processed/graph_scores.csv") \
        if os.path.exists("data/processed/graph_scores.csv") else pd.DataFrame()

    test_cases = [
        {
            "label": "GPS spoofer — ring member",
            "worker_id": 58,
            "features": {
                "gps_tower_delta":          1200,
                "accelerometer_variance":   0.1,
                "claim_response_time_sec":  22,
                "app_interaction_count":    1,
                "location_jump_flag":       1,
                "device_flagged":           0,
                "income_loss":              900,
                "trigger_value":            72.0,
                "eligibility_flag":         1,
                "events_used":              1,
                "events_remaining":         1,
                "renewal_count":            0,
                "days_active":              7,
                "plan_tier":                1,
                "weekly_premium":           79,
                "claim_auto_created":       1,
                "claim_valid_flag":         1,
            }
        },
        {
            "label": "Clean worker — genuine claim",
            "worker_id": 42,
            "features": {
                "gps_tower_delta":          45,
                "accelerometer_variance":   18.5,
                "claim_response_time_sec":  240,
                "app_interaction_count":    22,
                "location_jump_flag":       0,
                "device_flagged":           0,
                "income_loss":              600,
                "trigger_value":            80.0,
                "eligibility_flag":         1,
                "events_used":              1,
                "events_remaining":         1,
                "renewal_count":            3,
                "days_active":              14,
                "plan_tier":                2,
                "weekly_premium":           119,
                "claim_auto_created":       1,
                "claim_valid_flag":         1,
            }
        },
    ]

    print("\n🧪 Testing Fraud Pipeline...\n")
    for tc in test_cases:
        label     = tc["label"]
        worker_id = tc["worker_id"]
        features  = tc["features"]

        result = run_fraud_pipeline(
            features        = features,
            worker_id       = worker_id,
            graph_scores_df = graph_scores_df,
            tabular_model   = tabular_model,
            fraud_features  = fraud_features,
        )
        print(f"[{label}]")
        print(f"  Stage 1 : {result['stage1_rule_flags']}"
              f" → {result['stage1_rule_decision']}")
        print(f"  Stage 2 : behavior={result['stage2_behavior_score']:.4f}")
        print(f"  Stage 3 : cluster={result['stage3_cluster_score']:.4f}"
              f"  size={result['stage3_cluster_size']}")
        print(f"  Stage 4 : final={result['final_score']:.4f}"
              f"  pct={result['percentile']:.3f}")
        print(f"  ➜ {result['decision']}"
              f"  |  payout: {result['payout_status']}")
        if result.get("hold_duration"):
            print(f"  ➜ Hold: {result['hold_duration']}")
        print()

        