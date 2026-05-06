"""
Fraud Detection 4-Stage Cascade
================================
Stage 1 : Deterministic Rules          – GPS delta, accelerometer, timing, device blacklist
Stage 2 : Behavioral Scoring           – weighted GPS / motion / interaction / location-jump
Stage 3 : Ring Fraud Graph Detection   – DB-based cluster of co-filed same-event claims
Stage 4 : XGBoost + Adaptive Percentile – tabular model with scipy percentile calibration

Public API
----------
run_fraud_check(db, claim_id)  → dict   (main orchestrator)
compute_fraud_score(db, claim_id) → float  (backward-compat shim)
"""

import logging
import math
import time
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
from app.db.models.daily_operations import DailyOperation
from app.db.models.policy_claim import PolicyClaim
from app.db.models.worker import Worker
from app.ml.model_loader import (
    get_encoder,
    get_features,
    get_model,
    get_threshold,
    load_encoder,
    load_features,
    load_model,
    load_threshold,
)
from app.utils.cache_manager import FraudScoreCache
from scipy.stats import percentileofscore
from sqlalchemy import func
from sqlalchemy.orm import Session

logger = logging.getLogger("bhima.ml.fraud_inference")

# ---------------------------------------------------------------------------
# Device blacklist – populated by the security / ops team at runtime.
# Kept as an in-process set for sub-millisecond lookup.
# ---------------------------------------------------------------------------
DEVICE_BLACKLIST: set[str] = set()


# ===========================================================================
# UTILITY HELPERS
# ===========================================================================


def _safe_float(val: Any, default: float = 0.0) -> float:
    """Cast *val* to float; return *default* on None / error."""
    try:
        return float(val) if val is not None else default
    except (TypeError, ValueError):
        return default


def _safe_int(val: Any, default: int = 0) -> int:
    """Cast *val* to int; return *default* on None / error."""
    try:
        return int(val) if val is not None else default
    except (TypeError, ValueError):
        return default


def _norm(val: float, min_v: float, max_v: float, invert: bool = False) -> float:
    """
    Min-max normalise *val* to [0, 1].

    Parameters
    ----------
    invert : bool
        When True the result is (1 - normalised), so higher raw values produce
        lower scores (used for accelerometer variance and app-interaction count
        where more activity means *less* suspicious).
    """
    if max_v == min_v:
        return 0.0
    n = max(0.0, min(1.0, (val - min_v) / (max_v - min_v)))
    return (1.0 - n) if invert else n


def _safe_encode(encoder: Any, value: Any, default: int = 0) -> int:
    """
    Label-encode a single value with a fitted sklearn LabelEncoder.

    Falls back to *default* when the encoder is None, the value is None,
    or the value was not seen during training (unseen label).
    """
    try:
        if encoder is None or value is None:
            return default
        if hasattr(encoder, "classes_") and value not in encoder.classes_:
            return default
        return int(encoder.transform([value])[0])
    except Exception:
        return default


def _haversine_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Great-circle distance in metres between two GPS coordinates (Haversine).
    """
    R = 6_371_000.0  # Earth radius in metres
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = (
        math.sin(dphi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2.0) ** 2
    )
    return R * 2.0 * math.asin(math.sqrt(a))


# ===========================================================================
# STAGE 1 – Deterministic Rules
# ===========================================================================


def stage1_rules_check(
    claim: PolicyClaim,
    worker: Optional[Worker] = None,
) -> Tuple[float, List[str], str]:
    """
    Stage 1 – deterministic anti-spoofing rule engine (~0 ms).

    Rules
    -----
    • GPS-tower delta > 500 m     → ``gps_mismatch``
    • Accelerometer variance < 0.5 → ``no_motion``
    • Response time < 60 s        → ``timing_anomaly``
    • Device ID in DEVICE_BLACKLIST → ``device_blacklist``

    Returns
    -------
    rule_score : float
        ``len(flags) / 4``  in [0, 1].
    flags : list[str]
        Names of triggered rules.
    decision : str
        ``"REVIEW"`` when ≥ 2 flags triggered, else ``"PASS"``.
    """
    flags: List[str] = []

    # Rule 1 – GPS spoofing (claimed location vs nearest cell tower)
    if _safe_float(claim.gps_tower_delta) > 500:
        flags.append("gps_mismatch")

    # Rule 2 – Accelerometer flatline (vehicle / person not moving)
    if claim.accelerometer_variance is not None:
        if _safe_float(claim.accelerometer_variance) < 0.5:
            flags.append("no_motion")

    # Rule 3 – Implausibly fast claim submission
    if claim.claim_response_time_sec is not None:
        if _safe_float(claim.claim_response_time_sec) < 60:
            flags.append("timing_anomaly")

    # Rule 4 – Device on known-bad list
    if worker and worker.device_id and worker.device_id in DEVICE_BLACKLIST:
        flags.append("device_blacklist")

    rule_score = len(flags) / 4.0
    decision = "REVIEW" if len(flags) >= 2 else "PASS"

    logger.debug(
        "[FRAUD-S1] claim=%s  flags=%s  rule_score=%.3f  decision=%s",
        claim.claim_id,
        flags,
        rule_score,
        decision,
    )
    return rule_score, flags, decision


# ===========================================================================
# STAGE 2 – Behavioral Scoring
# ===========================================================================


def stage2_behavioral_score(
    claim: PolicyClaim,
    location_jump_flag: int = 0,
) -> Tuple[float, Dict[str, float]]:
    """
    Stage 2 – weighted behavioral signal scoring.

    Each raw field is min-max normalised; inverted signals mean *more activity
    = less suspicious*.

    Weights
    -------
    GPS component         0.30
    Motion component      0.25
    Interaction component 0.25
    Location-jump signal  0.20

    Returns
    -------
    behavior_score : float 0–1
    components     : dict of individual normalised component values
    """
    gps_delta = _safe_float(claim.gps_tower_delta)
    accel_var = _safe_float(claim.accelerometer_variance)
    app_int = _safe_float(claim.app_interaction_count)
    loc_jump = float(location_jump_flag)  # 0 or 1

    gps_component = _norm(gps_delta, 0.0, 5000.0)
    motion_component = _norm(accel_var, 0.0, 50.0, invert=True)
    interaction_component = _norm(app_int, 0.0, 60.0, invert=True)

    behavior_score = (
        0.30 * gps_component
        + 0.25 * motion_component
        + 0.25 * interaction_component
        + 0.20 * loc_jump
    )

    components: Dict[str, float] = {
        "gps_component": round(gps_component, 5),
        "motion_component": round(motion_component, 5),
        "interaction_component": round(interaction_component, 5),
        "location_jump": loc_jump,
    }

    logger.debug(
        "[FRAUD-S2] claim=%s  behavior_score=%.4f  components=%s",
        claim.claim_id,
        behavior_score,
        components,
    )
    return float(behavior_score), components


# ===========================================================================
# STAGE 3 – Ring Fraud Detection (DB-based graph clustering)
# ===========================================================================


def stage3_ring_detection(
    db: Session,
    claim: PolicyClaim,
) -> Tuple[float, Dict[str, Any], int]:
    """
    Stage 3 – simplified graph-based ring-fraud detector.

    Queries all *other* claims filed within a ±2-minute window that share
    the same ``trigger_type``.  GPS proximity < 200 m is used as a
    co-location signal.

    Scoring
    -------
    • cluster_size ≥ 8  → ring_score = 0.8
    • shared_location ≥ 2 → ring_score = max(ring_score, 0.6)
    • Otherwise → ring_score = 0.0

    Returns
    -------
    ring_score   : float 0–1
    details      : dict with cluster diagnostics
    cluster_size : int  (number of *other* co-filed claims in window)
    """
    try:
        if not claim.claim_timestamp:
            logger.warning(
                "[FRAUD-S3] claim=%s has no timestamp — skipping ring check",
                claim.claim_id,
            )
            return 0.0, {"cluster_size": 0, "shared_location": 0, "ring_score": 0.0}, 0

        window_start = claim.claim_timestamp - timedelta(minutes=2)
        window_end = claim.claim_timestamp + timedelta(minutes=2)

        related: List[PolicyClaim] = (
            db.query(PolicyClaim)
            .filter(
                PolicyClaim.claim_id != claim.claim_id,
                PolicyClaim.trigger_type == claim.trigger_type,
                PolicyClaim.claim_timestamp >= window_start,
                PolicyClaim.claim_timestamp <= window_end,
            )
            .all()
        )

        cluster_size = len(related)
        shared_location = 0
        ring_score = 0.0

        # GPS proximity pass
        for other in related:
            if (
                claim.gps_lat is not None
                and claim.gps_lng is not None
                and other.gps_lat is not None
                and other.gps_lng is not None
            ):
                dist = _haversine_meters(
                    claim.gps_lat,
                    claim.gps_lng,
                    other.gps_lat,
                    other.gps_lng,
                )
                if dist < 200.0:
                    shared_location += 1

        # Scoring rules (from spec)
        if cluster_size >= 8:
            ring_score = 0.8
        if shared_location >= 2:
            ring_score = max(ring_score, 0.6)

        details: Dict[str, Any] = {
            "cluster_size": cluster_size,
            "shared_location": shared_location,
            "ring_score": ring_score,
            "window_minutes": 2,
        }

        logger.debug(
            "[FRAUD-S3] claim=%s  cluster=%d  shared_loc=%d  ring_score=%.3f",
            claim.claim_id,
            cluster_size,
            shared_location,
            ring_score,
        )
        # -- Static fraud-graph lookup (training-time community signal) -----
        fraud_graph = get_model("fraud_graph")
        if fraud_graph is not None:
            node_id = f"W{claim.worker_id}"
            if fraud_graph.has_node(node_id):
                # Sum edge weights — heavier connections = higher community risk
                neighbor_weights = [
                    data.get("weight", 0.0)
                    for _, _, data in fraud_graph.edges(node_id, data=True)
                ]
                if neighbor_weights:
                    graph_community_score = float(
                        min(sum(neighbor_weights) / (len(neighbor_weights) * 2.0), 1.0)
                    )
                    # Blend: take the max of dynamic DB score and static graph score
                    old_ring = ring_score
                    ring_score = float(max(ring_score, graph_community_score * 0.7))
                    if ring_score > old_ring:
                        details["graph_community"] = {
                            "node": node_id,
                            "neighbor_count": len(neighbor_weights),
                            "avg_edge_weight": round(
                                sum(neighbor_weights) / len(neighbor_weights), 3
                            ),
                            "community_score": round(graph_community_score, 4),
                        }
                        logger.debug(
                            "[FRAUD-S3] Static graph boost for worker %s: "
                            "community_score=%.4f -> ring_score boosted to %.4f",
                            claim.worker_id,
                            graph_community_score,
                            ring_score,
                        )

        return ring_score, details, cluster_size

    except Exception as exc:
        logger.error(
            "[FRAUD-S3] claim=%s  error=%s", claim.claim_id, exc, exc_info=True
        )
        return 0.0, {"cluster_size": 0, "shared_location": 0, "error": str(exc)}, 0


# ===========================================================================
# STAGE 4 – XGBoost feature builder + adaptive percentile calibration
# ===========================================================================


def _build_feature_row(
    claim: PolicyClaim,
    worker: Optional[Worker],
    encoders: Dict[str, Any],
    feature_cols: List[str],
    days_active: int,
    aggregates: Dict[str, float],
) -> Optional[pd.DataFrame]:
    """
    Assemble the 32-feature single-row DataFrame expected by ``fraud_model``.

    Returns
    -------
    pd.DataFrame with one row aligned to *feature_cols*, or ``None`` on error.
    """
    try:
        # --- Categorical encoding (safe – falls back to class-index default) ---
        plan_enc = _safe_encode(encoders.get("plan_tier"), claim.plan_tier, default=1)
        status_enc = _safe_encode(
            encoders.get("policy_status"), claim.policy_status, default=0
        )

        # --- Derived flag ---
        abnormal_behavior_flag = int(
            _safe_float(claim.claim_response_time_sec) < 45
            and _safe_float(claim.gps_tower_delta) > 500
        )

        row: Dict[str, Any] = {
            # Policy / plan columns
            "plan_tier": plan_enc,
            "weekly_premium": _safe_float(claim.weekly_premium),
            "policy_status": status_enc,
            "eligibility_flag": _safe_int(claim.eligibility_flag),
            "events_used": _safe_int(claim.events_used),
            "events_remaining": _safe_int(claim.events_remaining),
            "renewal_count": _safe_int(claim.renewal_count),
            # Trigger / claim metadata
            "trigger_value": _safe_float(claim.trigger_value),
            "claim_auto_created": _safe_int(claim.claim_auto_created),
            "claim_valid_flag": _safe_int(claim.claim_valid_flag),
            "income_loss": _safe_float(claim.income_loss),
            # GPS / sensor
            "gps_lat": _safe_float(claim.gps_lat),
            "gps_lng": _safe_float(claim.gps_lng),
            "gps_tower_delta": _safe_float(claim.gps_tower_delta),
            "accelerometer_variance": _safe_float(claim.accelerometer_variance),
            "claim_response_time_sec": _safe_float(claim.claim_response_time_sec),
            "app_interaction_count": _safe_int(claim.app_interaction_count),
            # Worker-level features
            "days_active": days_active,
            "experience_level": _safe_float(
                worker.experience_level if worker else None
            ),
            "shift_hours": _safe_float(worker.shift_hours if worker else None),
            "fraud_risk_score": _safe_float(
                worker.fraud_risk_score if worker else None
            ),
            "kyc_verified": _safe_int(worker.kyc_verified if worker else None),
            "bank_verified": _safe_int(worker.bank_verified if worker else None),
            # Worker claim aggregates
            "claim_count": aggregates.get("claim_count", 0.0),
            "avg_income_loss": aggregates.get("avg_income_loss", 0.0),
            "std_income_loss": aggregates.get("std_income_loss", 0.0),
            "avg_response_time": aggregates.get("avg_response_time", 0.0),
            "avg_gps_delta": aggregates.get("avg_gps_delta", 0.0),
            "avg_accel_var": aggregates.get("avg_accel_var", 0.0),
            "avg_app_int": aggregates.get("avg_app_int", 0.0),
            "fraud_rate_worker": aggregates.get("fraud_rate_worker", 0.0),
            # Derived anomaly indicator
            "abnormal_behavior_flag": abnormal_behavior_flag,
        }

        # Align to exact training column order; fill any gap with 0
        df = pd.DataFrame([row]).reindex(columns=feature_cols, fill_value=0)
        return df

    except Exception as exc:
        logger.error("[FRAUD-S4] Feature build failed: %s", exc, exc_info=True)
        return None


def _compute_percentile(final_score: float, calibration: Any) -> float:
    """
    Return the [0, 1] percentile position of *final_score* within the
    historical *calibration* distribution using scipy.stats.percentileofscore.
    """
    return percentileofscore(calibration, final_score, kind="weak") / 100.0


def _fallback_score(
    rule_score: float,
    behavior_score: float,
    ring_score: float,
    cluster_size: int,
) -> Tuple[float, str]:
    """
    Rule-only fallback used when XGBoost model is unavailable.

    Mimics the Stage-4 formula but substitutes ``rule_score`` for the
    tabular model probability.

    Returns
    -------
    (final_score, decision)
    """
    cluster_effect = ring_score * (1.5 if cluster_size >= 3 else 1.0)
    cluster_effect = min(cluster_effect, 1.0)

    cluster_size_capped = min(cluster_size, 20)
    wc = min(0.20 + 0.08 * cluster_size_capped, 0.55)
    wt = 1.0 - wc

    base = wt * rule_score + wc * cluster_effect
    boost = 0.06 if cluster_size >= 4 else 0.0
    score = base + boost
    score += 0.15 * behavior_score + 0.10 * rule_score
    if cluster_size >= 3 and behavior_score > 0.5:
        score += 0.10

    final_score = float(np.clip(score, 0.0, 1.0))

    if final_score >= 0.65:
        decision = "BLOCK"
    elif final_score >= 0.40:
        decision = "REVIEW"
    else:
        decision = "APPROVE"

    return final_score, decision


# ===========================================================================
# MAIN ORCHESTRATOR
# ===========================================================================


def run_fraud_check(db: Session, claim_id: int) -> Dict[str, Any]:
    """
    Execute the complete 4-stage fraud pipeline for *claim_id*.

    Pipeline
    --------
    0. Load claim, worker, worker-level aggregates, days_active,
       and location_jump_flag from DB.
    1. Stage 1 – deterministic rules.
    2. Stage 2 – behavioral scoring.
    3. Stage 3 – ring fraud graph detection (DB queries).
    4. Stage 4 – XGBoost tabular model + scipy adaptive percentile.

    The claim row is updated with ``fraud_score``, ``fraud_flag``,
    ``payout_status``, and ``fraud_reason`` before the function returns.

    Returns
    -------
    dict
        Comprehensive fraud result including all stage details, suitable for
        consumption by ``fraud_agent.py`` and ``fraud_tasks.py``.
    """
    t_start = time.monotonic()

    # -----------------------------------------------------------------------
    # 0a. Load claim
    # -----------------------------------------------------------------------
    try:
        claim: Optional[PolicyClaim] = (
            db.query(PolicyClaim).filter(PolicyClaim.claim_id == claim_id).first()
        )
    except Exception as exc:
        logger.error("[FRAUD] DB error fetching claim_id=%s: %s", claim_id, exc)
        claim = None

    if claim is None:
        logger.error("[FRAUD] claim_id=%s not found", claim_id)
        elapsed = round((time.monotonic() - t_start) * 1000, 2)
        return {
            "claim_id": claim_id,
            "error": "Claim not found",
            "fraud_score": 0.0,
            "fraud_flag": False,
            "payout_action": "hold_48h",
            "fraud_reason": ["Claim not found in database"],
            "stage_breakdown": {},
            "stage_scores": {},
            "cluster_size": 0,
            "timestamp": datetime.utcnow().isoformat(),
            "processing_time_ms": elapsed,
            "stage_reached": "error",
        }

    try:
        # ── Cache check: fraud scores are immutable within the 48h hold window ──
        _cached_score = FraudScoreCache.get(claim_id)
        if _cached_score is not None:
            _cached_score["cached"] = True
            logger.info("[FRAUD] Cache HIT for claim_id=%s", claim_id)
            return _cached_score

        # -------------------------------------------------------------------
        # 0b. Load worker (non-fatal if missing)
        # -------------------------------------------------------------------
        worker: Optional[Worker] = (
            db.query(Worker).filter(Worker.worker_id == claim.worker_id).first()
        )

        logger.info(
            "[FRAUD] Starting 4-stage cascade — claim_id=%s  worker_id=%s",
            claim_id,
            claim.worker_id,
        )

        # -------------------------------------------------------------------
        # 0c. Worker-level claim aggregates (all historical claims)
        # -------------------------------------------------------------------
        worker_claims: List[PolicyClaim] = (
            db.query(PolicyClaim).filter(PolicyClaim.worker_id == claim.worker_id).all()
        )

        claim_count = len(worker_claims)

        def _col(attr: str) -> List[float]:
            return [
                _safe_float(getattr(c, attr))
                for c in worker_claims
                if getattr(c, attr) is not None
            ]

        income_losses = _col("income_loss")
        response_times = _col("claim_response_time_sec")
        gps_deltas = _col("gps_tower_delta")
        accel_vars = _col("accelerometer_variance")
        app_ints = _col("app_interaction_count")
        fraud_flags: List[float] = [
            float(bool(c.fraud_flag)) for c in worker_claims if c.fraud_flag is not None
        ]

        def _mean(lst: List[float]) -> float:
            return float(np.mean(lst)) if lst else 0.0

        aggregates: Dict[str, float] = {
            "claim_count": float(claim_count),
            "avg_income_loss": _mean(income_losses),
            "std_income_loss": float(np.std(income_losses))
            if len(income_losses) > 1
            else 0.0,
            "avg_response_time": _mean(response_times),
            "avg_gps_delta": _mean(gps_deltas),
            "avg_accel_var": _mean(accel_vars),
            "avg_app_int": _mean(app_ints),
            "fraud_rate_worker": _mean(fraud_flags),
        }

        # -------------------------------------------------------------------
        # 0d. days_active – distinct active dates in DailyOperation
        # -------------------------------------------------------------------
        days_active: int = (
            db.query(func.count(func.distinct(DailyOperation.date)))
            .filter(DailyOperation.worker_id == claim.worker_id)
            .scalar()
            or 0
        )

        # -------------------------------------------------------------------
        # 0e. location_jump_flag from DailyOperation on the claim date
        # -------------------------------------------------------------------
        location_jump_flag = 0
        if claim.claim_timestamp:
            claim_date = (
                claim.claim_timestamp.date()
                if hasattr(claim.claim_timestamp, "date")
                else claim.claim_timestamp
            )
            daily_op: Optional[DailyOperation] = (
                db.query(DailyOperation)
                .filter(
                    DailyOperation.worker_id == claim.worker_id,
                    DailyOperation.date == claim_date,
                )
                .first()
            )
            if daily_op and daily_op.location_jump_flag:
                location_jump_flag = 1

        # ===================================================================
        # STAGE 1 – Deterministic Rules
        # ===================================================================
        rule_score, s1_flags, rule_decision = stage1_rules_check(claim, worker)

        # ===================================================================
        # STAGE 2 – Behavioral Scoring
        # ===================================================================
        behavior_score, s2_components = stage2_behavioral_score(
            claim, location_jump_flag
        )

        # ===================================================================
        # STAGE 3 – Ring Fraud Detection
        # ===================================================================
        ring_score, s3_details, cluster_size = stage3_ring_detection(db, claim)

        # ===================================================================
        # STAGE 4 – XGBoost tabular model + adaptive percentile
        # ===================================================================

        # -- Load artefacts (try cache first, then lazy-load from disk) ------
        fraud_model = get_model("fraud_model") or load_model("fraud_model")
        _raw_feature_cols = get_features("fraud_features") or load_features(
            "fraud_features"
        )
        _cal = get_threshold("fraud_score_calibration")
        if _cal is None:
            _cal = load_threshold("fraud_score_calibration")
        if _cal is None:
            # Fallback: use raw training probability distribution
            _cal = get_threshold("fraud_prob_distribution")
        if _cal is None:
            _cal = load_threshold("fraud_prob_distribution")
        calibration = _cal
        claims_enc = get_encoder("claims_encoders") or load_encoder("claims_encoders")

        # fraud_features.pkl stores a list of column-name strings; the model_loader
        # type annotation says Dict (generic), so we normalise to List[str] here.
        feature_cols: Optional[List[str]] = (
            list(_raw_feature_cols) if _raw_feature_cols is not None else None
        )

        model_available = fraud_model is not None and feature_cols is not None

        # -- XGBoost inference -----------------------------------------------
        tabular_prob: Optional[float] = None
        if (
            fraud_model is not None
            and claims_enc is not None
            and feature_cols is not None
        ):
            feature_df = _build_feature_row(
                claim, worker, claims_enc, feature_cols, days_active, aggregates
            )
            if feature_df is not None:
                try:
                    tabular_prob = float(fraud_model.predict_proba(feature_df)[0][1])
                    logger.debug(
                        "[FRAUD-S4] claim=%s  tabular_prob=%.5f",
                        claim_id,
                        tabular_prob,
                    )
                except Exception as exc:
                    logger.error(
                        "[FRAUD-S4] XGBoost predict_proba failed: %s",
                        exc,
                        exc_info=True,
                    )
                    tabular_prob = None

        # -- Final score formula (from decision_engine.py) -------------------
        if tabular_prob is not None:
            cluster_size_capped = min(cluster_size, 20)
            wc = min(0.20 + 0.08 * cluster_size_capped, 0.55)
            wt = 1.0 - wc

            cluster_effect = ring_score * (1.5 if cluster_size >= 3 else 1.0)
            cluster_effect = min(cluster_effect, 1.0)

            base_score = wt * tabular_prob + wc * cluster_effect
            cluster_boost = 0.06 if cluster_size >= 4 else 0.0
            final_score = base_score + cluster_boost
            final_score += 0.15 * behavior_score + 0.10 * rule_score

            if cluster_size >= 3 and behavior_score > 0.5:
                final_score += 0.10

            final_score = float(np.clip(final_score, 0.0, 1.0))

            # -- Adaptive percentile decision --------------------------------
            if calibration is not None and len(calibration) > 0:
                pct = _compute_percentile(final_score, np.asarray(calibration))
            else:
                # Hard-coded fallback when calibration array is unavailable
                _thr = get_threshold("fraud_threshold")
                _thr = _thr if _thr is not None else load_threshold("fraud_threshold")
                raw_threshold = _safe_float(_thr, default=0.3321)
                if final_score >= raw_threshold + 0.30:
                    pct = 0.95
                elif final_score >= raw_threshold:
                    pct = 0.75
                else:
                    pct = 0.45

            if pct >= 0.90:
                decision = "BLOCK"
            elif pct >= 0.70:
                decision = "REVIEW"
            else:
                decision = "APPROVE"

        else:
            # No model available – pure rule-based fallback
            logger.warning(
                "[FRAUD-S4] claim=%s  model unavailable — using rule-based fallback",
                claim_id,
            )
            final_score, decision = _fallback_score(
                rule_score, behavior_score, ring_score, cluster_size
            )
            pct = float(final_score)  # rough proxy for display
            tabular_prob = 0.0

        # ===================================================================
        # Map decision → payout action + DB status + fraud_flag
        # ===================================================================
        if decision == "APPROVE":
            payout_action = "release_full"
            fraud_flag = False
            db_payout_status = "approved"
            hold_duration: Optional[str] = None
        elif decision == "REVIEW":
            payout_action = "hold_48h"
            fraud_flag = True
            db_payout_status = "hold_48h"
            hold_duration = "48h"
        else:  # BLOCK
            payout_action = "block_permanent"
            fraud_flag = True
            db_payout_status = "blocked"
            hold_duration = None

        # ===================================================================
        # Build fraud_reason list
        # ===================================================================
        reasons: List[str] = []

        if s1_flags:
            reasons.append(f"Stage-1 rule flags: {', '.join(s1_flags)}")

        if behavior_score > 0.5:
            reasons.append(
                f"Elevated behavioral score: {behavior_score:.4f} "
                f"(gps={s2_components['gps_component']:.3f}, "
                f"motion={s2_components['motion_component']:.3f}, "
                f"interaction={s2_components['interaction_component']:.3f})"
            )

        if ring_score > 0.0:
            reasons.append(
                f"Ring signal detected: cluster_size={cluster_size}, "
                f"shared_location={s3_details.get('shared_location', 0)}, "
                f"ring_score={ring_score:.2f}"
            )

        if tabular_prob is not None and tabular_prob > 0.5:
            reasons.append(f"XGBoost tabular probability: {tabular_prob:.4f}")

        if not reasons:
            reasons.append(f"All fraud checks passed — final_score={final_score:.4f}")
        else:
            reasons.append(
                f"Final fraud score: {final_score:.4f} "
                f"(percentile={pct:.2f}, decision={decision})"
            )

        # ===================================================================
        # 8. Persist fraud determination to DB
        # ===================================================================
        claim.fraud_score = round(final_score, 6)
        claim.fraud_flag = fraud_flag
        claim.payout_status = db_payout_status
        claim.fraud_reason = "; ".join(reasons)
        db.commit()

        # ===================================================================
        # Build and return result dict
        # ===================================================================
        elapsed_ms = round((time.monotonic() - t_start) * 1000, 2)

        stage_breakdown: Dict[str, Any] = {
            "stage1_rules": {
                "rule_score": round(rule_score, 5),
                "flags": s1_flags,
                "decision": rule_decision,
            },
            "stage2_behavior": {
                "behavior_score": round(behavior_score, 5),
                "components": s2_components,
                "location_jump_flag": location_jump_flag,
            },
            "stage3_graph": {
                **s3_details,
                "ring_score": ring_score,
            },
            "stage4_final": {
                "tabular_prob": round(tabular_prob, 5)
                if tabular_prob is not None
                else None,
                "final_score": round(final_score, 5),
                "percentile": round(pct, 4),
                "decision": decision,
                "model_used": model_available,
                **({"hold_duration": hold_duration} if hold_duration else {}),
            },
        }

        # Legacy key consumed by fraud_agent.py (stage_breakdown field in FraudFlag)
        stage_scores: Dict[str, float] = {
            "stage1": round(rule_score, 5),
            "stage2": round(behavior_score, 5),
            "stage3": round(ring_score, 5),
            "stage4": round(final_score, 5),
        }

        logger.info(
            "[FRAUD] Completed — claim_id=%s  score=%.4f  pct=%.2f  "
            "decision=%s  action=%s  model=%s  elapsed=%.1f ms",
            claim_id,
            final_score,
            pct,
            decision,
            payout_action,
            model_available,
            elapsed_ms,
        )

        return {
            "claim_id": claim_id,
            "worker_id": claim.worker_id,
            "fraud_score": round(final_score, 6),
            "fraud_flag": fraud_flag,
            "payout_action": payout_action,
            "fraud_reason": reasons,
            "stage_breakdown": stage_breakdown,
            "stage_scores": stage_scores,  # backward-compat
            "cluster_size": cluster_size,
            "timestamp": datetime.utcnow().isoformat(),
            "processing_time_ms": elapsed_ms,
            "stage_reached": "stage4" if model_available else "stage4_fallback",
        }

    except Exception as exc:
        logger.error(
            "[FRAUD] Unhandled error for claim_id=%s: %s", claim_id, exc, exc_info=True
        )
        elapsed_ms = round((time.monotonic() - t_start) * 1000, 2)

        # Best-effort DB update so the claim is never left undecided
        try:
            if claim is not None:
                claim.fraud_score = 0.5
                claim.fraud_flag = False
                claim.payout_status = "hold_48h"
                claim.fraud_reason = f"System error during fraud check: {exc}"
                db.commit()
        except Exception as inner:
            logger.error("[FRAUD] Failed to persist fallback state: %s", inner)

        return {
            "claim_id": claim_id,
            "error": str(exc),
            "fraud_score": 0.5,
            "fraud_flag": False,
            "payout_action": "hold_48h",
            "fraud_reason": [f"System error: {exc}. Claim held for manual review."],
            "stage_breakdown": {},
            "stage_scores": {},
            "cluster_size": 0,
            "timestamp": datetime.utcnow().isoformat(),
            "processing_time_ms": elapsed_ms,
            "stage_reached": "error",
        }


# ===========================================================================
# BACKWARD COMPATIBILITY SHIM
# ===========================================================================


def compute_fraud_score(db: Session, claim_id: int) -> float:
    """
    Return only the ``fraud_score`` float for callers that pre-date the full
    result dict API.  Delegates entirely to :func:`run_fraud_check`.
    """
    result = run_fraud_check(db, claim_id)
    return float(result.get("fraud_score", 0.0))
