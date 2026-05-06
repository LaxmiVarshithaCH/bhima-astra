"""
ML API Router — /ml/*
=====================
Core actuarial endpoints (all models covered):
  POST /ml/income-predict           → income_model.pkl          (XGBRegressor, 50 feat)
  POST /ml/risk-score               → disruption_realtime_model (XGBClassifier, 46 feat)
  POST /ml/premium-calculate        → premium_model.pkl         (Ridge, 11 feat)
  POST /ml/fraud-check              → fraud_model.pkl + fraud_graph.pkl (4-stage cascade)

Disruption-model dedicated endpoints:
  POST /ml/disruption-forecast      → disruption_forecast_model.pkl (XGBClassifier, 30 feat)
  POST /ml/disruption-behavioural   → disruption_model.pkl          (XGBClassifier, 29 feat)

Composite / utility ML endpoints:
  POST /ml/cds                      → CDS formula + disruption_realtime_threshold.pkl
  POST /ml/actuarial                → Full E[L] closed-loop (income → disruption → premium)
  POST /ml/payout-amount            → Payout calculator (plan × trigger × city × fraud)
  GET  /ml/city-tier/{city}         → City tier + all multipliers + payout table
  GET  /ml/fraud-graph/{worker_id}  → fraud_graph.pkl community lookup
  GET  /ml/model-status             → Health check for all 22 loaded artefacts
"""

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from app.core.deps import get_current_user
from app.db.session import get_db
from app.ml.fraud_inference import run_fraud_check
from app.services.ml_service import (
    # Core actuarial pipeline
    calculate_premium,
    compute_actuarial_pipeline,
    # Utility / composite
    compute_cds,
    compute_disruption_behavioural,
    # Disruption model variants
    compute_disruption_forecast,
    compute_payout_amount,
    compute_risk_score,
    get_all_model_status,
    get_city_tier_info,
    get_fraud_graph_info,
    predict_income,
)
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

logger = logging.getLogger("bhima.api.ml")

router = APIRouter(prefix="/ml", tags=["ML Models"])


# ============================================================================
# Request / Response schemas
# ============================================================================

# ── Income ──────────────────────────────────────────────────────────────────


class IncomeRequest(BaseModel):
    worker_id: int = Field(..., description="Worker ID to predict income for")


class IncomeResponse(BaseModel):
    worker_id: int
    expected_income: float = Field(..., description="Predicted daily income (₹/day)")
    income_baseline_weekly: float = Field(
        ..., description="Projected weekly income (₹/week)"
    )
    model_version: Optional[str] = None
    confidence: Optional[float] = None
    features_used: Optional[int] = None
    timestamp: Optional[str] = None
    error: Optional[str] = None


# ── Risk ────────────────────────────────────────────────────────────────────


class RiskRequest(BaseModel):
    worker_id: int = Field(..., description="Worker ID to score")


class RiskResponse(BaseModel):
    worker_id: int
    zone_risk_score: float = Field(
        ..., ge=0, le=1, description="Zone-level disruption risk [0-1]"
    )
    fraud_risk_score: float = Field(
        ..., ge=0, le=1, description="Worker fraud risk [0-1]"
    )
    combined_disruption_probability: float = Field(..., ge=0, le=1)
    p_rain_event: float = Field(0.0, ge=0, le=1)
    p_heat_event: float = Field(0.0, ge=0, le=1)
    p_aqi_event: float = Field(0.0, ge=0, le=1)
    city_tier: int = Field(..., description="City tier (1/2/3)")
    recommended_plan: str = Field(
        ..., description="Recommended plan: basic | standard | premium"
    )
    model_version: Optional[str] = None
    trigger_active: Optional[bool] = None
    risk_label: Optional[str] = None
    decision_threshold: Optional[float] = None
    timestamp: Optional[str] = None
    error: Optional[str] = None


# ── Premium ─────────────────────────────────────────────────────────────────


class PremiumRequest(BaseModel):
    worker_id: int = Field(..., description="Worker ID to calculate premium for")
    plan_tier: Optional[str] = Field(
        None,
        description="Override plan tier: basic | standard | premium. "
        "If omitted, the model recommends one.",
    )


class PremiumResponse(BaseModel):
    worker_id: int
    plan_tier: str
    base_premium: float = Field(..., description="Flat base rate for the tier (₹/week)")
    base_premium_adjusted: float = Field(..., description="Base rate × city multiplier")
    personalized_premium: float = Field(
        ..., description="Ridge-calibrated premium (₹/week)"
    )
    expected_loss: float = Field(..., description="Actuarial E[L] this week (₹)")
    expense_loading: float
    risk_margin: float
    city_tier: int
    city_multiplier: float
    severity_multiplier: float
    disruption_probability: float
    expected_weekly_income: float
    payout_l1: float = Field(..., description="Payout for L1 trigger (₹)")
    payout_l2: float = Field(..., description="Payout for L2 trigger (₹)")
    payout_l3: float = Field(..., description="Payout for L3 trigger (₹)")
    max_events_per_week: int = 2
    model: Optional[str] = None
    timestamp: Optional[str] = None
    error: Optional[str] = None


# ── Fraud ────────────────────────────────────────────────────────────────────


class StageBreakdown(BaseModel):
    # Stage 1 — deterministic rules
    stage1_rule_score: float = 0.0
    stage1_flags: List[str] = []
    stage1_decision: Optional[str] = None
    # Stage 2 — behavioral scoring
    stage2_behavior_score: float = 0.0
    stage2_components: Optional[Dict[str, float]] = None
    # Stage 3 — ring / graph detection
    stage3_ring_score: float = 0.0
    stage3_cluster_size: int = 1
    stage3_cluster_details: Optional[Dict[str, Any]] = None
    # Stage 4 — XGBoost + adaptive percentile
    stage4_tabular_prob: Optional[float] = None
    stage4_final_score: float = 0.0
    stage4_percentile: float = 0.0
    stage4_decision: Optional[str] = None
    model_used: bool = False


class FraudResponse(BaseModel):
    claim_id: int
    worker_id: Optional[int] = None
    fraud_score: float = Field(..., ge=0, le=1, description="Final fraud score [0-1]")
    fraud_flag: bool
    payout_action: str = Field(
        ...,
        description="release_full | release_partial | hold_48h | block_permanent",
    )
    fraud_reason: Optional[str] = None
    stage_breakdown: Optional[StageBreakdown] = None
    cluster_size: int = 1
    processing_time_ms: Optional[float] = None
    timestamp: Optional[str] = None
    error: Optional[str] = None


# ── Disruption Forecast ─────────────────────────────────────────────────────


class DisruptionForecastRequest(BaseModel):
    worker_id: int = Field(..., description="Worker ID to forecast disruption for")


class DisruptionForecastResponse(BaseModel):
    worker_id: int
    forecast_disruption_probability: float = Field(
        ...,
        ge=0,
        le=1,
        description="Probability of a disruption event in the forecast window [0-1]",
    )
    trigger_predicted: bool = Field(
        ..., description="True when probability exceeds the forecast threshold"
    )
    risk_label: str = Field(..., description="low | medium | high | critical")
    forecast_threshold: float
    p_rain_forward: Optional[float] = None
    p_heat_forward: Optional[float] = None
    p_aqi_forward: Optional[float] = None
    city_tier: Optional[int] = None
    city_multiplier: Optional[float] = None
    fraud_risk_score: Optional[float] = None
    model_version: Optional[str] = None
    model_type: Optional[str] = None
    note: Optional[str] = None
    timestamp: Optional[str] = None
    cached: Optional[bool] = None
    error: Optional[str] = None


# ── Disruption Behavioural ──────────────────────────────────────────────────


class DisruptionBehaviouralRequest(BaseModel):
    worker_id: int = Field(
        ..., description="Worker ID to score behavioural disruption vulnerability"
    )


class DisruptionBehaviouralResponse(BaseModel):
    worker_id: int
    behavioural_disruption_score: float = Field(
        ...,
        ge=0,
        le=1,
        description="Disruption vulnerability score based on profile + activity patterns [0-1]",
    )
    vulnerability_label: str = Field(..., description="low | medium | high")
    city_tier: Optional[int] = None
    city_multiplier: Optional[float] = None
    fraud_risk_score: Optional[float] = None
    model_version: Optional[str] = None
    n_features: Optional[int] = None
    note: Optional[str] = None
    timestamp: Optional[str] = None
    error: Optional[str] = None


# ── CDS ─────────────────────────────────────────────────────────────────────


class CDSRequest(BaseModel):
    rainfall_mm: float = Field(..., ge=0, description="Rainfall in mm (0–300)")
    aqi: float = Field(..., ge=0, description="Air Quality Index (0–500)")
    traffic_index: float = Field(
        ..., ge=0, le=100, description="Traffic congestion index (0–100)"
    )


class CDSComponentsSchema(BaseModel):
    r_norm: float
    aqi_norm: float
    traffic_norm: float


class CDSResponse(BaseModel):
    cds_score: float = Field(
        ..., ge=0, le=1, description="Composite Disruption Score [0-1]"
    )
    components: CDSComponentsSchema
    weights: Dict[str, float]
    inputs: Dict[str, float]
    severity_level: str = Field(..., description="L1 | L2 | L3 | BELOW_THRESHOLD")
    payout_percentage: float
    trigger_active: bool
    risk_label: str
    recommended_action: str
    thresholds_used: Dict[str, float]
    formula: str


# ── Actuarial Pipeline ───────────────────────────────────────────────────────


class ActuarialRequest(BaseModel):
    worker_id: int = Field(
        ..., description="Worker ID to run full actuarial pipeline for"
    )
    plan_tier: Optional[str] = Field(
        None, description="Override plan tier: basic | standard | premium"
    )


class ActuarialResponse(BaseModel):
    worker_id: int
    actuarial_formula: str
    pipeline_outputs: Dict[str, Any]
    summary: Dict[str, Any]


# ── City Tier ────────────────────────────────────────────────────────────────


class CityTierResponse(BaseModel):
    city: str
    tier: int
    tier_label: str
    city_multiplier: float
    severity_multiplier: float
    premium_bands: Dict[str, Any]
    payout_table: Dict[str, Any]
    same_tier_cities: List[str]
    rationale: str


# ── Payout Amount ────────────────────────────────────────────────────────────


class PayoutAmountRequest(BaseModel):
    plan_tier: str = Field(..., description="basic | standard | premium")
    trigger_level: str = Field(..., description="L1 | L2 | L3")
    city: str = Field(..., description="City name (e.g. Mumbai, Hyderabad)")
    fraud_release: str = Field(
        "release_full",
        description="release_full | release_partial | hold_48h | block_permanent",
    )


class PayoutAmountResponse(BaseModel):
    plan_tier: str
    trigger_level: str
    city: str
    city_tier: int
    fraud_release: str
    base_amount: float
    city_multiplier: float
    severity_multiplier: float
    final_payout: float
    all_fraud_scenarios: Dict[str, float]
    max_weekly_events: int
    max_weekly_payout: float


# ── Fraud Graph ──────────────────────────────────────────────────────────────


class FraudGraphResponse(BaseModel):
    worker_id: int
    node_id: str
    in_graph: bool
    degree: Optional[int] = None
    avg_edge_weight: Optional[float] = None
    total_edge_weight: Optional[float] = None
    community_score: Optional[float] = None
    community_risk: Optional[str] = None
    link_types: Optional[List[str]] = None
    shared_signal_types: Optional[List[str]] = None
    neighbour_worker_ids: Optional[List[int]] = None
    fraud_graph_stats: Optional[Dict[str, Any]] = None
    message: Optional[str] = None
    interpretation: Optional[str] = None
    error: Optional[str] = None


# ── Model Status ─────────────────────────────────────────────────────────────


class ModelArtefactStatus(BaseModel):
    name: str
    type: str
    loaded: bool
    class_: Optional[str] = Field(None, alias="class")
    n_features: Optional[int] = None
    count: Optional[int] = None
    shape: Optional[str] = None
    n_classes: Optional[int] = None

    class Config:
        populate_by_name = True


class ModelStatusResponse(BaseModel):
    status: str = Field(..., description="healthy | degraded")
    loaded: int
    total: int
    failed: int
    artefacts: List[Dict[str, Any]]


# ============================================================================
# Route handlers
# ============================================================================


@router.post(
    "/income-predict",
    response_model=IncomeResponse,
    summary="Predict expected income",
    description=(
        "Runs the trained XGBRegressor (income_model.pkl, 50 features) to predict "
        "a worker's expected daily and weekly income based on their recent operational data."
    ),
)
def income_predict(
    body: IncomeRequest,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    """POST /ml/income-predict"""
    try:
        result = predict_income(db, body.worker_id)
        if "error" in result:
            logger.warning(
                f"Income predict error for worker {body.worker_id}: {result['error']}"
            )
            raise HTTPException(status_code=422, detail=result["error"])

        return IncomeResponse(
            worker_id=body.worker_id,
            **result,
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(
            f"Income predict failed for worker {body.worker_id}: {exc}", exc_info=True
        )
        raise HTTPException(status_code=500, detail=str(exc))


@router.post(
    "/risk-score",
    response_model=RiskResponse,
    summary="Compute disruption and fraud risk",
    description=(
        "Runs the XGBClassifier (disruption_realtime_model.pkl, 46 features) to compute "
        "zone disruption probability, worker fraud risk, and recommend an insurance plan tier."
    ),
)
def risk_score(
    body: RiskRequest,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    """POST /ml/risk-score"""
    try:
        result = compute_risk_score(db, body.worker_id)
        if "error" in result:
            logger.warning(
                f"Risk score error for worker {body.worker_id}: {result['error']}"
            )
            raise HTTPException(status_code=422, detail=result["error"])

        return RiskResponse(
            worker_id=body.worker_id,
            **result,
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(
            f"Risk score failed for worker {body.worker_id}: {exc}", exc_info=True
        )
        raise HTTPException(status_code=500, detail=str(exc))


@router.post(
    "/premium-calculate",
    response_model=PremiumResponse,
    summary="Calculate personalised weekly premium",
    description=(
        "Runs the Ridge Regression model (premium_model.pkl) on aggregated worker features "
        "to compute a personalised weekly premium. Applies city-tier multiplier and clamps "
        "result within the plan-tier band (±20 %)."
    ),
)
def premium_calculate(
    body: PremiumRequest,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    """POST /ml/premium-calculate"""
    try:
        result = calculate_premium(db, body.worker_id, body.plan_tier or None)
        if "error" in result:
            logger.warning(
                f"Premium calc error for worker {body.worker_id}: {result['error']}"
            )
            raise HTTPException(status_code=422, detail=result["error"])

        return PremiumResponse(
            worker_id=body.worker_id,
            **result,
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(
            f"Premium calculate failed for worker {body.worker_id}: {exc}",
            exc_info=True,
        )
        raise HTTPException(status_code=500, detail=str(exc))


@router.post(
    "/fraud-check",
    response_model=FraudResponse,
    summary="Run 4-stage fraud detection cascade",
    description=(
        "Runs the complete 4-stage fraud detection pipeline on a claim:\n"
        "  Stage 1: Deterministic rules (GPS delta, accelerometer, timing, device)\n"
        "  Stage 2: Behavioral scoring (GPS/motion/interaction/location-jump)\n"
        "  Stage 3: Graph ring detection (same-event claim clustering)\n"
        "  Stage 4: XGBoost tabular + adaptive scipy percentile calibration\n\n"
        "Updates the claim's fraud_score, fraud_flag, and payout_status in the database."
    ),
)
def fraud_check(
    claim_id: int = Query(..., description="Claim ID to run fraud detection on"),
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    """POST /ml/fraud-check?claim_id=<id>"""
    try:
        result = run_fraud_check(db, claim_id)

        if "error" in result and result.get("error") == "Claim not found":
            raise HTTPException(status_code=404, detail=f"Claim {claim_id} not found")

        # Normalise nested stage_breakdown into the flat Pydantic schema.
        # fraud_inference.py returns each stage as a nested dict:
        #   stage_breakdown = {
        #     "stage1_rules":   {"rule_score": float, "flags": list, "decision": str},
        #     "stage2_behavior": {"behavior_score": float, "components": dict, ...},
        #     "stage3_graph":   {"ring_score": float, "cluster_size": int, ...},
        #     "stage4_final":   {"final_score": float, "percentile": float, ...},
        #   }
        raw_breakdown = result.get("stage_breakdown") or {}

        s1 = raw_breakdown.get("stage1_rules") or {}
        s2 = raw_breakdown.get("stage2_behavior") or {}
        s3 = raw_breakdown.get("stage3_graph") or {}
        s4 = raw_breakdown.get("stage4_final") or {}

        # Also accept legacy flat stage_scores dict for backward-compat
        legacy = result.get("stage_scores") or {}

        stage_breakdown = StageBreakdown(
            # Stage 1
            stage1_rule_score=float(s1.get("rule_score", legacy.get("stage1", 0.0))),
            stage1_flags=s1.get("flags", []) or [],
            stage1_decision=s1.get("decision"),
            # Stage 2
            stage2_behavior_score=float(
                s2.get("behavior_score", legacy.get("stage2", 0.0))
            ),
            stage2_components=s2.get("components"),
            # Stage 3
            stage3_ring_score=float(s3.get("ring_score", legacy.get("stage3", 0.0))),
            stage3_cluster_size=int(
                s3.get("cluster_size", result.get("cluster_size", 1))
            ),
            stage3_cluster_details={
                k: v for k, v in s3.items() if k not in ("ring_score", "cluster_size")
            }
            or None,
            # Stage 4
            stage4_tabular_prob=s4.get("tabular_prob"),
            stage4_final_score=float(
                s4.get(
                    "final_score", legacy.get("stage4", result.get("fraud_score", 0.0))
                )
            ),
            stage4_percentile=float(s4.get("percentile", 0.0)),
            stage4_decision=s4.get("decision"),
            model_used=bool(s4.get("model_used", False)),
        )

        # Map internal payout_action / payout_status to external action string
        payout_action_map = {
            "approved": "release_full",
            "release_full": "release_full",
            "hold_48h": "release_partial",  # 50% released immediately, 50% held
            "release_partial": "release_partial",
            "blocked": "block_permanent",
            "block_permanent": "block_permanent",
        }
        raw_action = result.get("payout_action") or result.get(
            "payout_status", "hold_48h"
        )
        payout_action = (
            payout_action_map.get(str(raw_action), str(raw_action))
            if raw_action
            else "hold_48h"
        )

        # Flatten fraud_reason: fraud_inference.py returns a list[str]
        raw_reason = result.get("fraud_reason")
        if isinstance(raw_reason, list):
            fraud_reason_str: Optional[str] = (
                "; ".join(str(r) for r in raw_reason) if raw_reason else None
            )
        else:
            fraud_reason_str = str(raw_reason) if raw_reason else None

        return FraudResponse(
            claim_id=claim_id,
            worker_id=result.get("worker_id"),
            fraud_score=float(result.get("fraud_score", 0.0)),
            fraud_flag=bool(result.get("fraud_flag", False)),
            payout_action=payout_action,
            fraud_reason=fraud_reason_str,
            stage_breakdown=stage_breakdown,
            cluster_size=int(result.get("cluster_size", 1)),
            processing_time_ms=result.get("processing_time_ms"),
            timestamp=result.get("timestamp") or datetime.utcnow().isoformat(),
            error=result.get("error"),
        )

    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Fraud check failed for claim {claim_id}: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


# ============================================================================
# NEW ENDPOINTS — All remaining models with dedicated API calls
# ============================================================================


@router.post(
    "/disruption-forecast",
    response_model=DisruptionForecastResponse,
    summary="Behavioural disruption forecast",
    description=(
        "Runs **disruption_forecast_model.pkl** (XGBClassifier, 30 features).\n\n"
        "Uses ONLY historical/behavioural features — worker profile, activity patterns, "
        "temporal signals — **without** live same-day sensor data (no IMD rainfall, no AQI). "
        "Suitable for 7-day-ahead disruption forecasting.\n\n"
        "Falls back to `disruption_model.pkl` (29 features) if the forecast model is unavailable. "
        "Applies `disruption_forecast_threshold.pkl` (0.631) to produce `trigger_predicted`."
    ),
)
def disruption_forecast(
    body: DisruptionForecastRequest,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    """POST /ml/disruption-forecast"""
    try:
        result = compute_disruption_forecast(db, body.worker_id)
        if result.get("error") and "not found" in result["error"].lower():
            raise HTTPException(status_code=404, detail=result["error"])
        return DisruptionForecastResponse(
            worker_id=body.worker_id,
            **{k: v for k, v in result.items() if k != "worker_id"},
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(
            f"Disruption forecast failed for worker {body.worker_id}: {exc}",
            exc_info=True,
        )
        raise HTTPException(status_code=500, detail=str(exc))


@router.post(
    "/disruption-behavioural",
    response_model=DisruptionBehaviouralResponse,
    summary="Pure behavioural disruption vulnerability score",
    description=(
        "Runs **disruption_model.pkl** (XGBClassifier, 29 features) explicitly.\n\n"
        "Scores a worker's **inherent disruption vulnerability** based purely on their "
        "delivery behaviour, platform, zone history, and experience — completely independent "
        "of current environmental conditions. Useful for underwriting and plan assignment "
        "during worker onboarding before any live sensor data is available.\n\n"
        "Returns `behavioural_disruption_score` [0-1] and `vulnerability_label` (low/medium/high)."
    ),
)
def disruption_behavioural(
    body: DisruptionBehaviouralRequest,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    """POST /ml/disruption-behavioural"""
    try:
        result = compute_disruption_behavioural(db, body.worker_id)
        if result.get("error") and "not found" in result.get("error", "").lower():
            raise HTTPException(status_code=404, detail=result["error"])
        return DisruptionBehaviouralResponse(
            worker_id=body.worker_id,
            **{k: v for k, v in result.items() if k != "worker_id"},
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(
            f"Disruption behavioural failed for worker {body.worker_id}: {exc}",
            exc_info=True,
        )
        raise HTTPException(status_code=500, detail=str(exc))


@router.post(
    "/cds",
    response_model=CDSResponse,
    summary="Compute Composite Disruption Score",
    description=(
        "Computes the **Composite Disruption Score** from raw environmental sensor readings:\n\n"
        "```\nCDS = 0.50 × R_norm + 0.30 × AQI_norm + 0.20 × Traffic_norm\n```\n\n"
        "- `R_norm` = rainfall_mm / 300  \n"
        "- `AQI_norm` = aqi / 500  \n"
        "- `Traffic_norm` = traffic_index / 100  \n\n"
        "Applies **`disruption_realtime_threshold.pkl`** (0.998) for `trigger_active` and "
        "`disruption_forecast_threshold.pkl` (0.631) for `risk_label` bands.\n\n"
        "Maps CDS to severity: **L1** (0.30–0.49, 50% payout) | **L2** (0.50–0.74, 75%) | "
        "**L3** (≥0.75, 100% payout)."
    ),
)
def cds_score(
    body: CDSRequest,
    _user=Depends(get_current_user),
):
    """POST /ml/cds"""
    try:
        result = compute_cds(body.rainfall_mm, body.aqi, body.traffic_index)
        return CDSResponse(**result)
    except Exception as exc:
        logger.error(f"CDS computation failed: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


@router.post(
    "/actuarial",
    response_model=ActuarialResponse,
    summary="Full actuarial closed-loop pipeline",
    description=(
        "Runs the complete **4-step actuarial engine** in a single call:\n\n"
        "1. **income_model.pkl** (XGBRegressor) → `Ŷ_income` (predicted daily earnings)\n"
        "2. **disruption_realtime_model.pkl** (XGBClassifier) → `P_disruption`\n"
        "3. **E[L] formula** → `E[L_weekly] = P_disruption × (Ŷ_income_weekly × S_event × 0.60)`\n"
        "4. **premium_model.pkl** (Ridge) → `personalized_premium`\n\n"
        "Returns a full breakdown of every intermediate value with model versions for audit."
    ),
)
def actuarial_pipeline(
    body: ActuarialRequest,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    """POST /ml/actuarial"""
    try:
        result = compute_actuarial_pipeline(db, body.worker_id, body.plan_tier or None)
        if "error" in result:
            raise HTTPException(status_code=422, detail=result["error"])
        return ActuarialResponse(**result)
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(
            f"Actuarial pipeline failed for worker {body.worker_id}: {exc}",
            exc_info=True,
        )
        raise HTTPException(status_code=500, detail=str(exc))


@router.post(
    "/payout-amount",
    response_model=PayoutAmountResponse,
    summary="Calculate exact payout for a claim context",
    description=(
        "Computes the final payout amount for a given combination of:\n\n"
        "- **plan_tier**: basic | standard | premium\n"
        "- **trigger_level**: L1 | L2 | L3\n"
        "- **city**: applies city-tier multiplier + Tier-2/3 severity multiplier\n"
        "- **fraud_release**: release_full | release_partial (50%) | hold_48h (₹0) | block_permanent (₹0)\n\n"
        "Returns the final payout, all multipliers applied, and all four fraud-scenario amounts."
    ),
)
def payout_amount(
    body: PayoutAmountRequest,
    _user=Depends(get_current_user),
):
    """POST /ml/payout-amount"""
    try:
        result = compute_payout_amount(
            body.plan_tier, body.trigger_level, body.city, body.fraud_release
        )
        return PayoutAmountResponse(**result)
    except Exception as exc:
        logger.error(f"Payout amount failed: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


@router.get(
    "/city-tier/{city}",
    response_model=CityTierResponse,
    summary="City tier lookup with multipliers and payout table",
    description=(
        "Returns the city's tier classification, all multipliers, and a complete payout table "
        "for all plan × trigger level combinations.\n\n"
        "**Tier 1** (Mumbai, Delhi, Bengaluru, Chennai) → 1.2× multiplier  \n"
        "**Tier 2** (Hyderabad, Pune, Ahmedabad, Kolkata, Jaipur) → 1.0× baseline  \n"
        "**Tier 3** (all other cities) → 0.85× multiplier + 1.6× severity  \n\n"
        "No authentication required — public reference endpoint."
    ),
)
def city_tier(
    city: str,
    _user=Depends(get_current_user),
):
    """GET /ml/city-tier/{city}"""
    try:
        result = get_city_tier_info(city)
        return CityTierResponse(**result)
    except Exception as exc:
        logger.error(f"City tier lookup failed for {city}: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


@router.get(
    "/fraud-graph/{worker_id}",
    response_model=FraudGraphResponse,
    summary="Worker fraud community from fraud_graph.pkl",
    description=(
        "Queries **fraud_graph.pkl** — a static NetworkX graph (400 nodes, 132 edges) built "
        "from the training dataset using Louvain community detection.\n\n"
        "Nodes are workers (`W{worker_id}`). Edges encode shared fraud signals:\n"
        "- `time_window` — claims filed within 45 seconds of each other\n"
        "- `device_similarity` — matching device fingerprints\n"
        "- `location_proximity` — GPS within 100m of another filer\n\n"
        "Returns `community_score` (0–1), `community_risk` (none/low/medium/high), "
        "neighbour worker IDs, and edge weight statistics.\n\n"
        "**Note**: This is a STATIC training-time signal — it captures historical fraud ring "
        "membership, not live claim behaviour. Used as Stage 3 boost in the fraud cascade."
    ),
)
def fraud_graph(
    worker_id: int,
    _user=Depends(get_current_user),
):
    """GET /ml/fraud-graph/{worker_id}"""
    try:
        result = get_fraud_graph_info(worker_id)
        if result.get("error") and "not loaded" in result.get("error", ""):
            raise HTTPException(status_code=503, detail=result["error"])
        return FraudGraphResponse(**result)
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(
            f"Fraud graph query failed for worker {worker_id}: {exc}", exc_info=True
        )
        raise HTTPException(status_code=500, detail=str(exc))


@router.get(
    "/model-status",
    response_model=ModelStatusResponse,
    summary="Health check for all 22 ML artefacts",
    description=(
        "Returns load status for every artefact in the ML model registry:\n\n"
        "- 7 **models** (XGBRegressor, XGBClassifier ×4, Ridge, NetworkX Graph)\n"
        "- 6 **feature lists** (.pkl column lists)\n"
        "- 5 **thresholds / calibration arrays**\n"
        "- 1 **scaler** (StandardScaler for Ridge premium model)\n"
        "- 3 **encoders** (LabelEncoder dicts for workers, daily ops, claims)\n\n"
        "Returns `status: healthy` when all 22 artefacts are loaded, `degraded` otherwise. "
        "Used by the admin agent-status dashboard."
    ),
)
def model_status(
    _user=Depends(get_current_user),
):
    """GET /ml/model-status"""
    try:
        result = get_all_model_status()
        return ModelStatusResponse(**result)
    except Exception as exc:
        logger.error(f"Model status check failed: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


# ── Convenience GET wrappers (backwards-compatible with the original router) ──


@router.get(
    "/income-predict",
    response_model=IncomeResponse,
    summary="[GET] Predict expected income for current worker",
    description="Convenience GET endpoint — uses the authenticated worker's ID from the JWT.",
    include_in_schema=False,
)
def income_predict_get(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    worker_id = getattr(current_user, "worker_id", None)
    if worker_id is None:
        raise HTTPException(status_code=400, detail="Worker ID not found in token")
    result = predict_income(db, worker_id)
    if "error" in result:
        raise HTTPException(status_code=422, detail=result["error"])
    return IncomeResponse(worker_id=worker_id, **result)


@router.get(
    "/risk-score",
    response_model=RiskResponse,
    summary="[GET] Risk score for current worker",
    include_in_schema=False,
)
def risk_score_get(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    worker_id = getattr(current_user, "worker_id", None)
    if worker_id is None:
        raise HTTPException(status_code=400, detail="Worker ID not found in token")
    result = compute_risk_score(db, worker_id)
    if "error" in result:
        raise HTTPException(status_code=422, detail=result["error"])
    return RiskResponse(worker_id=worker_id, **result)


@router.get(
    "/premium-calculate",
    response_model=PremiumResponse,
    summary="[GET] Premium calculation for current worker",
    include_in_schema=False,
)
def premium_calculate_get(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    worker_id = getattr(current_user, "worker_id", None)
    if worker_id is None:
        raise HTTPException(status_code=400, detail="Worker ID not found in token")
    result = calculate_premium(db, worker_id)
    if "error" in result:
        raise HTTPException(status_code=422, detail=result["error"])
    return PremiumResponse(worker_id=worker_id, **result)


@router.get(
    "/fraud-check",
    response_model=FraudResponse,
    summary="[GET] Fraud check by claim_id",
    include_in_schema=False,
)
def fraud_check_get(
    claim_id: int = Query(..., description="Claim ID to check"),
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    return fraud_check(claim_id=claim_id, db=db, _user=_user)
