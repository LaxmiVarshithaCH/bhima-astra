"""
ML Service - Routing to trained models

Replaces all mock functions with actual ML model inference.
Integrated models:
- Random Forest: Income prediction
- XGBoost: Risk/Disruption scoring
- Ridge: Premium calculation
- XGBoost + LSTM + Louvain + Adaptive: Fraud detection
"""

from app.ml.income_inference import predict_income as ml_predict_income
from app.ml.income_inference import predict_income_loss
from app.ml.premium_inference import calculate_premium as ml_calculate_premium
from app.ml.risk_inference import compute_risk_score as ml_compute_risk_score
from app.utils.cache_manager import ActuarialCache
from sqlalchemy.orm import Session

# ============================================================================
# INCOME PREDICTION - Random Forest Model
# ============================================================================


def predict_income(db: Session, worker_id: int):
    """
    Predict expected daily income using Random Forest model.

    Uses actual trained income_model.pkl with 18 behavioral features.
    R² ≈ 0.87 accuracy.
    """
    result = ml_predict_income(db, worker_id)
    return result


# ============================================================================
# RISK SCORING - XGBoost Model
# ============================================================================


def compute_risk_score(db: Session, worker_id: int):
    """
    Compute disruption and fraud risk using XGBoost model.

    Returns zone_risk_score, fraud_risk_score, combined_disruption_probability.
    AUC-ROC ≈ 0.91 accuracy.
    """
    result = ml_compute_risk_score(db, worker_id)
    return result


# ============================================================================
# PREMIUM CALCULATION - Ridge Regression + Actuarial Formula
# ============================================================================


def calculate_premium(db: Session, worker_id: int, plan_tier: str = None):
    """
    Calculate personalized weekly premium using Ridge Regression model.

    Formula: Weekly_Premium = E[L] + Expense_Loading + Risk_Margin
    E[L] = P_disruption × (Ŷ_income × S_event)

    Returns premium with city tier and severity multipliers applied.
    """
    result = ml_calculate_premium(db, worker_id, plan_tier)
    return result


# ============================================================================
# DISRUPTION FORECAST — disruption_forecast_model.pkl (30 features)
# ============================================================================


def compute_disruption_forecast(db: Session, worker_id: int):
    """7-day behavioural disruption forecast. No live sensor data required."""
    from app.ml.risk_inference import compute_disruption_forecast as _ml_fn

    return _ml_fn(db, worker_id)


# ============================================================================
# DISRUPTION BEHAVIOURAL — disruption_model.pkl (29 features)
# ============================================================================


def compute_disruption_behavioural(db: Session, worker_id: int):
    """Pure behavioural model — worker profile + activity patterns only."""
    from app.ml.risk_inference import compute_disruption_behavioural as _ml_fn

    return _ml_fn(db, worker_id)


# ============================================================================
# COMPOSITE DISRUPTION SCORE — CDS formula + disruption_realtime_threshold.pkl
# ============================================================================


def compute_cds(rainfall_mm: float, aqi: float, traffic_index: float) -> dict:
    """
    Compute Composite Disruption Score:
      CDS = 0.5×R_norm + 0.3×AQI_norm + 0.2×Traffic_norm
    Apply disruption_realtime_threshold.pkl to determine trigger_active.
    Map to severity level L1/L2/L3 per spec thresholds.
    """
    import numpy as np
    from app.ml.model_loader import get_threshold, load_threshold

    r_norm = float(np.clip(rainfall_mm / 300.0, 0.0, 1.0))
    aqi_norm = float(np.clip(aqi / 500.0, 0.0, 1.0))
    traffic_norm = float(np.clip(traffic_index / 100.0, 0.0, 1.0))

    cds = round(0.5 * r_norm + 0.3 * aqi_norm + 0.2 * traffic_norm, 4)

    # Realtime trigger threshold
    _thr = get_threshold("disruption_realtime_threshold")
    if _thr is None:
        _thr = load_threshold("disruption_realtime_threshold")
    rt_threshold = float(_thr) if _thr is not None else 0.998

    # Forecast risk-label threshold
    _fc = get_threshold("disruption_forecast_threshold")
    if _fc is None:
        _fc = load_threshold("disruption_forecast_threshold")
    fc_threshold = float(_fc) if _fc is not None else 0.631

    trigger_active = bool(cds >= rt_threshold)

    # Severity per spec: L1 0.30-0.49, L2 0.50-0.74, L3 >=0.75
    if cds >= 0.75:
        severity_level = "L3"
        payout_pct = 1.00
        recommended_action = "FULL_PAYOUT — Trigger event + manager alert"
    elif cds >= 0.50:
        severity_level = "L2"
        payout_pct = 0.75
        recommended_action = "STANDARD_PAYOUT — Trigger event fired"
    elif cds >= 0.30:
        severity_level = "L1"
        payout_pct = 0.50
        recommended_action = "PARTIAL_PAYOUT — Notification only"
    else:
        severity_level = "BELOW_THRESHOLD"
        payout_pct = 0.00
        recommended_action = "NO_PAYOUT — Below minimum threshold"

    # Risk label using forecast bands
    if cds >= fc_threshold:
        risk_label = "critical" if cds >= 0.85 else "high"
    elif cds >= fc_threshold * 0.65:
        risk_label = "medium"
    else:
        risk_label = "low"

    return {
        "cds_score": cds,
        "components": {
            "r_norm": round(r_norm, 4),
            "aqi_norm": round(aqi_norm, 4),
            "traffic_norm": round(traffic_norm, 4),
        },
        "weights": {"W1_rainfall": 0.50, "W2_aqi": 0.30, "W3_traffic": 0.20},
        "inputs": {
            "rainfall_mm": rainfall_mm,
            "aqi": aqi,
            "traffic_index": traffic_index,
        },
        "severity_level": severity_level,
        "payout_percentage": payout_pct,
        "trigger_active": trigger_active,
        "risk_label": risk_label,
        "recommended_action": recommended_action,
        "thresholds_used": {
            "realtime_trigger": round(rt_threshold, 6),
            "forecast_label": round(fc_threshold, 6),
        },
        "formula": "CDS = 0.50×R_norm + 0.30×AQI_norm + 0.20×Traffic_norm",
    }


# ============================================================================
# ACTUARIAL PIPELINE — income_model + disruption_realtime + premium_model
# ============================================================================


def compute_actuarial_pipeline(
    db: Session, worker_id: int, plan_tier: str = None
) -> dict:
    """
    Full actuarial closed-loop in one call:
      Step 1 → income_model.pkl  : Ŷ_income
      Step 2 → disruption_realtime_model.pkl : P_disruption
      Step 3 → E[L] = P_disruption × (Ŷ_income × S_event × 7 × 0.60)
      Step 4 → premium_model.pkl + Ridge → personalized_premium
    """
    from app.ml.income_inference import predict_income as _income
    from app.ml.premium_inference import calculate_premium as _premium
    from app.ml.risk_inference import SEVERITY_MULTIPLIERS
    from app.ml.risk_inference import compute_risk_score as _risk

    # ── Cache check: 15-min TTL matches Celery beat poll interval ──────────
    _cache_tier = plan_tier or "auto"
    _cached = ActuarialCache.get(worker_id, _cache_tier)
    if _cached is not None:
        _cached["cached"] = True
        return _cached

    income_result = _income(db, worker_id)
    risk_result = _risk(db, worker_id)
    prem_result = _premium(db, worker_id, plan_tier)

    income_daily = float(income_result.get("expected_income", 0.0))
    disrupt_prob = float(risk_result.get("combined_disruption_probability", 0.0))
    city_tier = int(risk_result.get("city_tier", 2))
    severity_mult = float(SEVERITY_MULTIPLIERS.get(city_tier, 1.0))

    # E[L_weekly] = P_disruption × (Ŷ_income_weekly × S_event × 0.60 loss-ratio)
    income_weekly = income_daily * 7.0
    expected_loss = round(disrupt_prob * (income_weekly * severity_mult * 0.60), 2)
    expense_load = round(expected_loss * 0.10, 2)
    risk_margin = round(expected_loss * 0.25, 2)

    return {
        "worker_id": worker_id,
        "actuarial_formula": "E[L] = P_disruption × (Ŷ_income_weekly × S_event × 0.60)",
        "pipeline_outputs": {
            "step1_income_model": {
                "predicted_income_daily": round(income_daily, 2),
                "predicted_income_weekly": round(income_weekly, 2),
                "model_version": income_result.get("model_version"),
            },
            "step2_disruption_model": {
                "disruption_probability": round(disrupt_prob, 4),
                "zone_risk_score": round(
                    float(risk_result.get("zone_risk_score", 0)), 4
                ),
                "trigger_active": risk_result.get("trigger_active", False),
                "risk_label": risk_result.get("risk_label", "low"),
                "model_version": risk_result.get("model_version"),
            },
            "step3_expected_loss": {
                "severity_multiplier": severity_mult,
                "city_tier": city_tier,
                "loss_ratio_assumption": 0.60,
                "expected_loss_weekly": expected_loss,
                "expense_loading_10pct": expense_load,
                "risk_margin_25pct": risk_margin,
                "actuarial_premium_floor": round(
                    expected_loss + expense_load + risk_margin, 2
                ),
            },
            "step4_premium_model": {
                "plan_tier": prem_result.get("plan_tier"),
                "base_premium": prem_result.get("base_premium"),
                "personalized_premium": prem_result.get("personalized_premium"),
                "city_multiplier": prem_result.get("city_multiplier"),
                "payout_l1": prem_result.get("payout_l1"),
                "payout_l2": prem_result.get("payout_l2"),
                "payout_l3": prem_result.get("payout_l3"),
                "model": prem_result.get("model"),
            },
        },
        "summary": {
            "expected_loss_weekly": expected_loss,
            "personalized_premium": prem_result.get("personalized_premium"),
            "income_protection_pct": round((expected_loss / income_weekly * 100), 1)
            if income_weekly > 0
            else 0,
            "recommended_plan": prem_result.get("plan_tier"),
        },
    }


# ============================================================================
# CITY TIER — multipliers + payout bands
# ============================================================================


def get_city_tier_info(city: str) -> dict:
    """City tier lookup returning all multipliers, payout bands, and plan info."""
    from app.ml.premium_inference import BASE_PREMIUMS, PAYOUT_RATES_BASE
    from app.ml.risk_inference import (
        CITY_TIER_MAP,
        CITY_TIER_MULTIPLIERS,
        SEVERITY_MULTIPLIERS,
        get_city_tier,
    )

    tier = get_city_tier(city)
    city_mult = CITY_TIER_MULTIPLIERS.get(tier, 1.0)
    severity_mult = SEVERITY_MULTIPLIERS.get(tier, 1.0) if tier > 1 else 1.0
    tier_label = {1: "tier1", 2: "tier2", 3: "tier3"}[tier]

    # Compute city-adjusted payouts for all plans
    payout_table = {}
    for plan, levels in PAYOUT_RATES_BASE.items():
        payout_table[plan] = {}
        for level, base in levels.items():
            adjusted = base * city_mult
            if tier > 1:
                adjusted *= severity_mult
            payout_table[plan][level] = round(adjusted, 2)

    # Known cities in this tier
    same_tier = [c.title() for c, t in CITY_TIER_MAP.items() if t == tier]

    return {
        "city": city.title(),
        "tier": tier,
        "tier_label": tier_label,
        "city_multiplier": city_mult,
        "severity_multiplier": severity_mult,
        "premium_bands": {
            p: {"base": v, "adjusted": round(v * city_mult, 2)}
            for p, v in BASE_PREMIUMS.items()
        },
        "payout_table": payout_table,
        "same_tier_cities": same_tier,
        "rationale": {
            1: "High cost of living, dense Q-commerce — 1.2× multiplier",
            2: "Baseline — 1.0× multiplier",
            3: "Lower income baseline — 0.85× multiplier + 1.6× severity",
        }.get(tier, ""),
    }


# ============================================================================
# PAYOUT AMOUNT — plan × trigger × city × fraud decision
# ============================================================================


def compute_payout_amount(
    plan_tier: str,
    trigger_level: str,
    city: str,
    fraud_release: str = "release_full",
) -> dict:
    """Compute exact payout amount for a given claim context."""
    from app.ml.premium_inference import PAYOUT_RATES_BASE, get_payout_amount
    from app.ml.risk_inference import (
        CITY_TIER_MULTIPLIERS,
        SEVERITY_MULTIPLIERS,
        get_city_tier,
    )

    city_tier = get_city_tier(city)
    city_mult = CITY_TIER_MULTIPLIERS.get(city_tier, 1.0)
    severity_mult = SEVERITY_MULTIPLIERS.get(city_tier, 1.0) if city_tier > 1 else 1.0
    base_amount = PAYOUT_RATES_BASE.get(plan_tier, {}).get(trigger_level, 0)
    payout = get_payout_amount(plan_tier, trigger_level, city_tier, fraud_release)

    payout_after_fraud = {
        "release_full": round(base_amount * city_mult * severity_mult, 2),
        "release_partial": round(base_amount * city_mult * severity_mult * 0.5, 2),
        "hold_48h": 0.0,
        "block_permanent": 0.0,
    }

    return {
        "plan_tier": plan_tier,
        "trigger_level": trigger_level,
        "city": city.title(),
        "city_tier": city_tier,
        "fraud_release": fraud_release,
        "base_amount": float(base_amount),
        "city_multiplier": city_mult,
        "severity_multiplier": severity_mult,
        "final_payout": payout,
        "all_fraud_scenarios": payout_after_fraud,
        "max_weekly_events": 2,
        "max_weekly_payout": round(payout_after_fraud["release_full"] * 2, 2),
    }


# ============================================================================
# FRAUD GRAPH — fraud_graph.pkl community lookup
# ============================================================================


def get_fraud_graph_info(worker_id: int) -> dict:
    """
    Query the static training-time fraud community graph (fraud_graph.pkl, 400 nodes, 132 edges).
    Returns whether the worker is in a known fraud cluster and their community metrics.
    """
    import networkx as nx
    from app.ml.model_loader import get_model

    g = get_model("fraud_graph")
    if g is None:
        return {"error": "Fraud graph not loaded", "in_graph": False}

    node_id = f"W{worker_id}"
    graph_stats = {
        "total_nodes": g.number_of_nodes(),
        "total_edges": g.number_of_edges(),
    }

    if not g.has_node(node_id):
        return {
            "worker_id": worker_id,
            "node_id": node_id,
            "in_graph": False,
            "community_risk": "none",
            "community_score": 0.0,
            "message": "Worker not present in training fraud community graph — no historical ring signal",
            "fraud_graph_stats": graph_stats,
        }

    edges = list(g.edges(node_id, data=True))
    if not edges:
        return {
            "worker_id": worker_id,
            "node_id": node_id,
            "in_graph": True,
            "degree": 0,
            "community_risk": "none",
            "community_score": 0.0,
            "fraud_graph_stats": graph_stats,
        }

    weights = [d.get("weight", 0.0) for _, _, d in edges]
    shared_attrs = [d.get("shared_attrs", []) for _, _, d in edges]
    link_types = list({d.get("link_type", "unknown") for _, _, d in edges})
    neighbour_ids = [int(v.lstrip("W")) for u, v, _ in edges if u == node_id]

    community_score = float(min(sum(weights) / (len(weights) * 2.0), 1.0))

    if community_score >= 0.60:
        community_risk = "high"
    elif community_score >= 0.30:
        community_risk = "medium"
    elif community_score > 0.0:
        community_risk = "low"
    else:
        community_risk = "none"

    return {
        "worker_id": worker_id,
        "node_id": node_id,
        "in_graph": True,
        "degree": len(edges),
        "avg_edge_weight": round(sum(weights) / len(weights), 3),
        "total_edge_weight": round(sum(weights), 3),
        "community_score": round(community_score, 4),
        "community_risk": community_risk,
        "link_types": link_types,
        "shared_signal_types": list({s for attrs in shared_attrs for s in attrs}),
        "neighbour_worker_ids": neighbour_ids[:10],
        "fraud_graph_stats": graph_stats,
        "interpretation": (
            "Worker appeared in a fraud community cluster in training data. "
            "This is a STATIC signal from historical patterns."
            if community_risk in ("medium", "high")
            else "Worker has low-weight connections — minimal historical fraud signal."
        ),
    }


# ============================================================================
# MODEL STATUS — all 22 artefacts health check
# ============================================================================


def get_all_model_status() -> dict:
    """Health check for all 22 trained ML artefacts loaded at startup."""
    from app.ml.model_loader import (
        ENCODER_PATHS,
        FEATURE_PATHS,
        MODEL_PATHS,
        SCALER_PATHS,
        THRESHOLD_PATHS,
        get_encoder,
        get_features,
        get_model,
        get_scaler,
        get_threshold,
    )

    artefacts = []

    for name in MODEL_PATHS:
        obj = get_model(name)
        artefacts.append(
            {
                "name": name,
                "type": "model",
                "loaded": obj is not None,
                "class": type(obj).__name__ if obj is not None else None,
                "n_features": int(getattr(obj, "n_features_in_", 0))
                if obj is not None
                else None,
            }
        )

    for name in FEATURE_PATHS:
        obj = get_features(name)
        artefacts.append(
            {
                "name": name,
                "type": "feature_list",
                "loaded": obj is not None,
                "count": len(obj) if obj is not None else None,
            }
        )

    for name in THRESHOLD_PATHS:
        obj = get_threshold(name)
        import numpy as np

        artefacts.append(
            {
                "name": name,
                "type": "threshold",
                "loaded": obj is not None,
                "shape": str(np.asarray(obj).shape) if obj is not None else None,
            }
        )

    for name in SCALER_PATHS:
        obj = get_scaler(name)
        artefacts.append(
            {
                "name": name,
                "type": "scaler",
                "loaded": obj is not None,
                "n_features": int(getattr(obj, "n_features_in_", 0))
                if obj is not None
                else None,
            }
        )

    for name in ENCODER_PATHS:
        obj = get_encoder(name)
        artefacts.append(
            {
                "name": name,
                "type": "encoder",
                "loaded": obj is not None,
                "n_classes": len(obj) if isinstance(obj, dict) else None,
            }
        )

    loaded = sum(1 for a in artefacts if a["loaded"])
    total = len(artefacts)

    return {
        "status": "healthy" if loaded == total else "degraded",
        "loaded": loaded,
        "total": total,
        "failed": total - loaded,
        "artefacts": artefacts,
    }
