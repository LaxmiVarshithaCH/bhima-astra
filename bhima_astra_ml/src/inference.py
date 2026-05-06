"""BHIMA ASTRA agentic orchestration inference pipeline."""

import os
import sys
import joblib
import numpy as np
import pandas as pd
import asyncio
from manager_agent import ManagerIntelligenceAgent, Coordinates, CrowdSignals, ZoneContext, ManagerAlert
from decision_engine import make_fraud_decision
sys.path.insert(0, "src")

from fraud_pipeline import run_fraud_pipeline

def get_city_config(city):
    CITY_CONFIG = {
        "Hyderabad": {"tier": 1, "multiplier": 1.0},
        "Vijayawada": {"tier": 2, "multiplier": 1.4},
        "Bangalore": {"tier": 1, "multiplier": 1.0},
    }
    return CITY_CONFIG.get(city, {"tier": 2, "multiplier": 1.2})



MODELS = {}
GRAPH_SCORES = None


def _load_models():
    paths = {
        "income": "models/income_model.pkl",
        "income_features": "models/income_features.pkl",
        "disruption_forecast": "models/disruption_forecast_model.pkl",
        "disruption_forecast_feat": "models/disruption_forecast_features.pkl",
        "disruption_realtime": "models/disruption_realtime_model.pkl",
        "disruption_realtime_feat": "models/disruption_realtime_features.pkl",
        "fraud": "models/fraud_model.pkl",
        "fraud_features": "models/fraud_features.pkl",
    }

    missing = []
    for key, path in paths.items():
        if os.path.exists(path):
            MODELS[key] = joblib.load(path)
        else:
            missing.append(path)

    if missing:
        print(f"Warning: missing model files: {missing}")


def _load_graph_scores():
    global GRAPH_SCORES
    graph_scores_path = "data/processed/graph_scores.csv"
    if os.path.exists(graph_scores_path):
        GRAPH_SCORES = pd.read_csv(graph_scores_path)


def _align(features, feat_cols):
    row = pd.DataFrame([features])

    # ✅ FIX: encode categorical features BEFORE reindex
    if "plan_tier" in row.columns:
        # Lowercase the strings just to be safe before mapping
        row["plan_tier"] = row["plan_tier"].astype(str).str.lower()
        tier_map = {
            "basic": 0,
            "standard": 1,
            "premium": 2
        }
        row["plan_tier"] = row["plan_tier"].map(tier_map).fillna(1)

    # Reindex AFTER encoding
    row = row.reindex(columns=feat_cols, fill_value=0)

    # Convert to numeric safely
    row = row.apply(pd.to_numeric, errors='coerce').fillna(0)

    return row


def _clip01(value):
    return float(np.clip(float(value), 0.0, 1.0))


def _safe_float(value, default=0.0):
    try:
        return float(value)
    except (TypeError, ValueError):
        return float(default)


def predict_income(features):
    model = MODELS.get("income")
    feat_cols = MODELS.get("income_features", [])
    if model is None:
        return {"error": "Income model not loaded"}

    row = _align(features, feat_cols)
    prediction = max(0.0, float(model.predict(row)[0]))
    return {"predicted_income": round(prediction, 2)}


def predict_disruption(features):
    model = MODELS.get("disruption_forecast")
    feat_cols = MODELS.get("disruption_forecast_feat", [])

    if model is None or not feat_cols:
        model = MODELS.get("disruption_realtime")
        feat_cols = MODELS.get("disruption_realtime_feat", [])

    if model is None:
        return {"error": "Disruption model not loaded"}

    row = _align(features, feat_cols)
    prob = _clip01(model.predict_proba(row)[0][1])
    return {"disruption_probability": round(prob, 4)}


def fraud_check(features=None, worker_id=0):
    model = MODELS.get("fraud")
    feat_cols = MODELS.get("fraud_features", [])

    if model is None:
        return {"error": "Fraud model not loaded"}

    features = features or {}

    # 🔥 BUILD FULL FEATURE VECTOR MATCHING TRAINING
    fraud_input = {}

    for col in feat_cols:
        fraud_input[col] = features.get(col, 0)

    # ✅ IMPORTANT FIX: ensure categorical encoding
    if "plan_tier" in fraud_input:
        tier_map = {"basic": 0, "standard": 1, "premium": 2}
        fraud_input["plan_tier"] = tier_map.get(fraud_input["plan_tier"], 1)

    return run_fraud_pipeline(
        features=fraud_input,
        worker_id=int(worker_id),
        graph_scores_df=GRAPH_SCORES,
        tabular_model=model,
        fraud_features=feat_cols,
    )
def get_fraud_decision(features=None, worker_id=0):
    fraud_raw = fraud_check(features=features or {}, worker_id=worker_id)
    
    decision_engine_out = make_fraud_decision(
        tabular_prob = fraud_raw.get("tabular_prob") or fraud_raw.get("fraud_probability", 0.2),
        cluster_score = fraud_raw.get("cluster_score", 0.1),
        cluster_size = fraud_raw.get("cluster_size", 1),
        behavior_score = fraud_raw.get("behavior_score", 0.0),
        rule_score = fraud_raw.get("rule_score", 0.0),
        worker_id = worker_id,
        features = features
    )
    
    return decision_engine_out["decision"], decision_engine_out


def compute_cds(features):
    r_norm = _safe_float(features.get("R_norm", _safe_float(features.get("rainfall", 0.0)) / 204.5))
    aqi_norm = _safe_float(features.get("AQI_norm", _safe_float(features.get("AQI", 0.0)) / 500.0))
    traffic_norm = _safe_float(features.get("Traffic_norm", _safe_float(features.get("traffic_index", 0.0)) / 100.0))

    r_norm = _clip01(r_norm)
    aqi_norm = _clip01(aqi_norm)
    traffic_norm = _clip01(traffic_norm)

    cds = (0.5 * r_norm) + (0.3 * aqi_norm) + (0.2 * traffic_norm)
    return round(cds, 4), r_norm, aqi_norm, traffic_norm


def cds_to_severity(cds):
    cds = _safe_float(cds)
    if cds < 0.40:
        return "L1", 1.0
    if cds < 0.70:
        return "L2", 1.3
    return "L3", 1.6


def actuarial_decision(expected_loss):
    """Baseline actuarial decision using expected-loss buckets."""
    loss = _safe_float(expected_loss)
    if loss >= 1200:
        return "HOLD", 0.0
    if loss >= 500:
        return "PARTIAL", round(loss * 0.5, 2)
    return "APPROVE", round(loss, 2)


def run_agentic_orchestration(
    features,
    city,
    worker_id=0,
    zone_id=None,
    manager_alert=False,
    manager_cds_threshold=0.45,
    manager_rng_seed=None,
):
    """Fraud -> Manager -> Actuarial priority pipeline."""

    agent_logs = []
    features = features or {}

    # 1. Load features
    agent_logs.append("Loaded input features")

    # 2. Predict income and disruption probability
    income_res = predict_income(features)
    if "error" in income_res:
        raise RuntimeError(income_res["error"])
    income = _safe_float(income_res["predicted_income"])
    agent_logs.append(f"Income model predicted: {income:.2f}")

    disruption_res = predict_disruption(features)
    if "error" in disruption_res:
        raise RuntimeError(disruption_res["error"])
    disruption_prob = _safe_float(disruption_res["disruption_probability"])
    agent_logs.append(f"Disruption model probability: {disruption_prob:.4f}")

    # 3. Compute CDS
    cds_score, r_norm, aqi_norm, traffic_norm = compute_cds(features)
    agent_logs.append(
        "CDS computed: "
        f"0.5*R_norm({r_norm:.3f}) + 0.3*AQI_norm({aqi_norm:.3f}) + "
        f"0.2*Traffic_norm({traffic_norm:.3f}) = {cds_score:.4f}"
    )

    # 4. Severity from CDS
    severity_level, severity_multiplier = cds_to_severity(cds_score)
    agent_logs.append(
        f"Severity mapped from CDS: {severity_level} -> {severity_multiplier:.2f}"
    )

    # 5. Apply city multiplier
    city_cfg = get_city_config(city)
    city_multiplier = _safe_float(city_cfg.get("multiplier", 1.0), 1.0)
    adjusted_severity = round(severity_multiplier * city_multiplier, 4)
    agent_logs.append(
        f"City multiplier applied ({city}, tier {city_cfg.get('tier')}): "
        f"{severity_multiplier:.2f} x {city_multiplier:.2f} = {adjusted_severity:.4f}"
    )

    # 6. Expected loss
    expected_loss = round(disruption_prob * (income * adjusted_severity), 2)
    agent_logs.append(f"Expected loss computed: {expected_loss:.2f}")

    # Decision priority: Fraud -> Manager -> Actuarial
    # ✅ FIX: Ensure required fraud features exist
    features.setdefault("plan_tier", "standard")
    
    fraud_result, fraud_payload = get_fraud_decision(features=features, worker_id=worker_id)
    agent_logs.append(f"Fraud pipeline decision: {fraud_result}")

    if fraud_result == "BLOCK":
        decision = "BLOCK"
        payout = 0.0
        decision_source = "Fraud"
        agent_logs.append("Fraud BLOCK takes priority: payout forced to 0")
    else:
        manager_agent = ManagerIntelligenceAgent()
        
        # Call the REAL agent logic asynchronously
        manager_out = asyncio.run(
            manager_agent.verify_disruption(
                delivery_zone_coords=Coordinates(features.get("lat", 16.5062), features.get("lon", 80.6480)),  
                dark_store_coords=Coordinates(features.get("store_lat", 16.5065), features.get("store_lon", 80.6490)),
                crowd_signals=CrowdSignals(
                    avg_rider_velocity=features.get("velocity", 1.5),
                    rider_density=features.get("density", 0.8),
                    crowd_duration_minutes=features.get("duration", 12)
                ),
                zone_context=ZoneContext(
                    city_multiplier=city_multiplier,
                    zone_risk_score=1.2,
                    zone_type="high_density"
                ),
                manager_alert=ManagerAlert(
                    manager_id="MGR-001",
                    manager_alert_flag=bool(manager_alert),
                    manager_trust_score=0.7
                )
            )
        )

        agent_logs.append(
            "Manager agent evaluated: "
            f"status={manager_out.verified_status} confidence={manager_out.confidence_score}"
        )

        # Handle the strict outputs from your VerificationResult dataclass safely
        status = str(manager_out.verified_status)
        
        if "CONFIRMED" in status:
            decision = "APPROVE"
            payout = expected_loss
            decision_source = "Manager"
        elif "PARTIAL" in status:
            decision = "PARTIAL"
            payout = expected_loss * manager_out.payout_multiplier
            decision_source = "Manager"
        else:
            decision = "REJECT"
            payout = 0.0
            decision_source = "Manager"

    explanation = {"en": decision}  

    return {
        "decision": decision,
        "payout_amount": round(_safe_float(payout), 2),
        "tier_multiplier_applied": city_multiplier,
        "decision_source": decision_source,
        "explanation": explanation,
        "agent_logs": agent_logs,
    }


_load_models()
_load_graph_scores()


if __name__ == "__main__":
    sample_features = {
        "orders_per_day": 32,
        "surge_multiplier": 1.25,
        "incentive_bonus": 80,
        "tip_amount": 15,
        "peak_hour_flag": 1,
        "weekend_flag": 0,
        "day_of_week": 3,
        "month": 7,
        "rainfall": 72.0,
        "temperature": 31.0,
        "AQI": 220,
        "traffic_index": 65,
        "flood_alert": 0,
        "composite_score": 0.52,
        "platform_outage": 0,
        "zone_shutdown": 0,
        "curfew_flag": 0,
        "strike_flag": 0,
        "rolling_orders_3d": 28,
        "days_since_last_active": 0,
        "experience_level": 3,
        "shift_hours": 10,
        "fraud_risk_score": 0.12,
        "cancelled_orders_ratio": 0.05,
        "location_jump_flag": 0,
        "device_switch_count": 0,
        "gps_tower_delta": 850,
        "accelerometer_variance": 0.3,
        "claim_response_time_sec": 25,
        "app_interaction_count": 1,
    }

    out = run_agentic_orchestration(
        features=sample_features,
        city="Vijayawada",
        worker_id=58,
        zone_id="VJA-12",
        manager_alert=(sample_features.get("curfew_flag", 0) == 1),
        manager_rng_seed=42,
    )
    print(out)
