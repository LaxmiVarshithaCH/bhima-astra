"""
Risk & Disruption Inference — XGBClassifier Model

Predicts disruption probability for a gig worker using the realtime
XGBoost classifier (disruption_realtime_model.pkl) with 46 features
aligned via disruption_realtime_features.pkl.

Falls back to disruption_forecast_model when the realtime model is
unavailable. Results are cached in Redis with a 30-minute TTL.

Public surface
--------------
    CITY_TIER_MAP           – city → tier mapping (used by premium_inference)
    CITY_TIER_MULTIPLIERS   – tier → premium multiplier
    SEVERITY_MULTIPLIERS    – tier → severity multiplier
    get_city_tier(city)     – returns 1 / 2 / 3
    compute_risk_score(db, worker_id) → dict
"""

import logging
from datetime import datetime

import numpy as np
import pandas as pd
from app.db.models.daily_operations import DailyOperation
from app.db.models.worker import Worker
from app.ml.model_loader import (
    get_encoder,
    get_features,
    get_model,
    get_threshold,
    load_threshold,
)
from app.utils.cache_manager import WorkerCache
from sqlalchemy.orm import Session

logger = logging.getLogger("bhima.ml.risk_inference")

# ---------------------------------------------------------------------------
# City-tier configuration  (imported by premium_inference.py — keep public)
# ---------------------------------------------------------------------------

CITY_TIER_MAP: dict[str, int] = {
    "mumbai": 1,
    "delhi": 1,
    "bangalore": 1,
    "bengaluru": 1,
    "chennai": 1,
    "hyderabad": 2,
    "pune": 2,
    "ahmedabad": 2,
    "kolkata": 2,
    "jaipur": 2,
}

# Tier → premium multiplier applied to zone_risk_score
CITY_TIER_MULTIPLIERS: dict[int, float] = {1: 1.2, 2: 1.0, 3: 0.85}

# Tier → severity multiplier used for loss / payout scaling
SEVERITY_MULTIPLIERS: dict[int, float] = {1: 1.0, 2: 1.3, 3: 1.6}


# ---------------------------------------------------------------------------
# Public helpers
# ---------------------------------------------------------------------------


def get_city_tier(city_name: str) -> int:
    """
    Return the tier (1 / 2 / 3) for a given city name.

    Tier-1 : major metros  (Mumbai, Delhi, Bangalore, Chennai, Bengaluru)
    Tier-2 : large cities  (Hyderabad, Pune, Ahmedabad, Kolkata, Jaipur)
    Tier-3 : all others    (default)

    Parameters
    ----------
    city_name : str
        City name string (case-insensitive; leading/trailing whitespace ignored).

    Returns
    -------
    int
        1, 2, or 3.
    """
    return CITY_TIER_MAP.get((city_name or "").strip().lower(), 3)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _safe_encode(encoder, value, default: int = 0) -> int:
    """
    Safely label-encode a single value with a fitted LabelEncoder.

    Returns *default* when the encoder is None, the value is None,
    or the value was unseen during training.
    """
    try:
        if encoder is None or value is None:
            return default
        return int(encoder.transform([str(value)])[0])
    except Exception:
        return default


def _build_disruption_feature_dict(db: Session, worker_id: int) -> dict:
    """
    Build the 46-feature dict required by the disruption realtime model.

    Feature groups
    --------------
    • 32  DailyOperation columns  (same as income set, minus disruption_flag
                                   and sudden_income_spike)
    • 2   derived from op.date    (month, ISO week)
    • 11  Worker columns          (categoricals label-encoded)
    • 1   derived composite       (weather_stress)
    Total = 46

    Note: orders_std and active_days_ratio are also excluded (they require
    disruption_flag to be meaningful and are only in the income feature set).

    Returns an empty dict on any unrecoverable error.
    """
    try:
        # ------------------------------------------------------------------ #
        # 1. Worker lookup
        # ------------------------------------------------------------------ #
        worker: Worker = db.query(Worker).filter(Worker.worker_id == worker_id).first()
        if worker is None:
            logger.warning(f"[risk] Worker {worker_id} not found")
            return {}

        # ------------------------------------------------------------------ #
        # 2. Latest DailyOperation
        # ------------------------------------------------------------------ #
        latest_op: DailyOperation = (
            db.query(DailyOperation)
            .filter(DailyOperation.worker_id == worker_id)
            .order_by(DailyOperation.date.desc())
            .first()
        )
        if latest_op is None:
            logger.warning(f"[risk] No DailyOperation records for worker {worker_id}")
            return {}

        # ------------------------------------------------------------------ #
        # 3. Encoders
        # ------------------------------------------------------------------ #
        encoders: dict = get_encoder("workers_encoders") or {}

        # ------------------------------------------------------------------ #
        # 4. Convenience aliases & derived scalars
        # ------------------------------------------------------------------ #
        op = latest_op
        rain = float(op.rainfall or 0.0)
        aqi_val = float(op.aqi or 0.0)
        traffic_val = float(op.traffic_index or 0.0)

        weather_stress = (
            0.4 * (rain / 300.0) + 0.3 * (aqi_val / 500.0) + 0.3 * (traffic_val / 100.0)
        )

        # ------------------------------------------------------------------ #
        # 5. Assemble raw dict  (46 keys)
        # ------------------------------------------------------------------ #
        raw: dict = {
            # ---- 32 × DailyOperation  (disruption_flag & sudden_income_spike excluded) ----
            "day_of_week": int(op.day_of_week or 0),
            "hour_of_day": int(op.hour_of_day or 0),
            "peak_hour_flag": int(bool(op.peak_hour_flag)),
            "weekend_flag": int(bool(op.weekend_flag)),
            "orders_per_day": float(op.orders_per_day or 0),
            "orders_per_hour": float(op.orders_per_hour or 0.0),
            "delivery_distance_km": float(op.delivery_distance_km or 0.0),
            "surge_multiplier": float(op.surge_multiplier or 1.0),
            "incentive_bonus": float(op.incentive_bonus or 0.0),
            "tip_amount": float(op.tip_amount or 0.0),
            "rolling_orders_3d": float(op.rolling_orders_3d or 0.0),
            "days_since_last_active": int(op.days_since_last_active or 0),
            "rainfall": rain,
            "temperature": float(op.temperature or 25.0),
            "heat_index": float(op.heat_index or 25.0),
            "AQI": aqi_val,  # op.aqi       → AQI
            "traffic_index": traffic_val,
            "flood_alert": int(bool(op.flood_alert)),
            "wind_speed": float(op.wind_speed or 0.0),
            "road_closure_flag": int(bool(op.road_closure_flag)),
            "R_norm": float(op.r_norm or 0.0),  # op.r_norm       → R_norm
            "AQI_norm": float(op.aqi_norm or 0.0),  # op.aqi_norm     → AQI_norm
            "Traffic_norm": float(
                op.traffic_norm or 0.0
            ),  # op.traffic_norm → Traffic_norm
            "composite_score": float(op.composite_score or 0.0),
            "composite_threshold": float(op.composite_threshold or 0.0),
            "platform_outage": int(bool(op.platform_outage)),
            "zone_shutdown": int(bool(op.zone_shutdown)),
            "curfew_flag": int(bool(op.curfew_flag)),
            "strike_flag": int(bool(op.strike_flag)),
            # disruption_flag and sudden_income_spike intentionally excluded
            "location_jump_flag": int(bool(op.location_jump_flag)),
            "device_switch_count": int(op.device_switch_count or 0),
            "cancelled_orders_ratio": float(op.cancelled_orders_ratio or 0.0),
            # ---- 2 × derived from op.date ----
            "month": int(op.date.month),
            "week": int(op.date.isocalendar()[1]),
            # ---- 11 × Worker + label-encoded categoricals ----
            "platform": _safe_encode(encoders.get("platform"), worker.platform),
            "city": _safe_encode(encoders.get("city"), worker.city),
            "geo_zone_id": _safe_encode(
                encoders.get("geo_zone_id"), worker.geo_zone_id
            ),
            "vehicle_type": _safe_encode(
                encoders.get("vehicle_type"), worker.vehicle_type
            ),
            "shift_hours": float(worker.shift_hours or 8.0),
            "experience_level": float(worker.experience_level or 1.0),
            "employment_type": _safe_encode(
                encoders.get("employment_type"), worker.employment_type
            ),
            "kyc_verified": int(bool(worker.kyc_verified)),
            "bank_verified": int(bool(worker.bank_verified)),
            "fraud_risk_score": float(worker.fraud_risk_score or 0.0),
            "payment_verified_status": _safe_encode(
                encoders.get("payment_verified_status"), worker.payment_verified_status
            ),
            # ---- 1 × derived composite (orders_std / active_days_ratio excluded) ----
            "weather_stress": float(weather_stress),
        }

        return raw

    except Exception as exc:
        logger.error(
            f"[risk] Error building feature dict for worker {worker_id}: {exc}",
            exc_info=True,
        )
        return {}


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def compute_risk_score(db: Session, worker_id: int) -> dict:
    """
    Compute disruption and fraud risk for a worker.

    Uses ``disruption_realtime_model`` (XGBClassifier, 46 features) as the
    primary model and falls back to ``disruption_forecast_model`` when the
    realtime model or its feature list is unavailable.

    The zone_risk_score is the raw disruption probability scaled by the
    city-tier multiplier.  fraud_risk_score is read directly from the worker
    record (maintained by the fraud pipeline — not recomputed here).

    Results are cached in Redis for 30 minutes.

    Parameters
    ----------
    db : Session
        Active SQLAlchemy session.
    worker_id : int
        Primary key of the worker.

    Returns
    -------
    dict with keys:
        zone_risk_score                 – probability × city-tier multiplier, clipped [0, 1]
        fraud_risk_score                – from worker.fraud_risk_score
        combined_disruption_probability – raw model output, clipped [0, 1]
        p_rain_event                    – component probability for rain
        p_heat_event                    – component probability for heat
        p_aqi_event                     – component probability for poor AQI
        city_tier                       – 1 / 2 / 3
        recommended_plan                – "basic" | "standard" | "premium"
        model_version                   – identifier string
        timestamp                       – ISO-8601 UTC string
        cached                          – True when result came from Redis
        error                           – present only on failure
    """
    try:
        # ------------------------------------------------------------------ #
        # 1. Cache check  (30-minute TTL)
        # ------------------------------------------------------------------ #
        cached = WorkerCache.get_risk_score(worker_id)
        if cached is not None:
            cached["cached"] = True
            return cached

        # ------------------------------------------------------------------ #
        # 2. Worker lookup  (needed for fraud_risk_score + city_tier)
        # ------------------------------------------------------------------ #
        worker: Worker = db.query(Worker).filter(Worker.worker_id == worker_id).first()
        if worker is None:
            logger.warning(f"[risk] Worker {worker_id} not found")
            return {
                "error": "Worker not found",
                "zone_risk_score": 0.5,
                "fraud_risk_score": 0.1,
                "combined_disruption_probability": 0.3,
                "cached": False,
            }

        fraud_risk = float(worker.fraud_risk_score or 0.0)
        city_tier = get_city_tier(worker.city or "")

        # ------------------------------------------------------------------ #
        # 3. Load model + feature list  (realtime → forecast fallback)
        # ------------------------------------------------------------------ #
        model = get_model("disruption_realtime_model")
        feat_cols = get_features("disruption_realtime_features")
        model_version = "xgb_disruption_realtime_v1"

        if model is None or feat_cols is None:
            logger.warning(
                "[risk] Realtime disruption model unavailable; "
                "falling back to forecast model"
            )
            model = get_model("disruption_forecast_model")
            feat_cols = get_features("disruption_forecast_features")
            model_version = "xgb_disruption_forecast_v1"

        if model is None or feat_cols is None:
            logger.warning(
                "[risk] Forecast disruption model unavailable; "
                "falling back to behavioural model"
            )
            model = get_model("disruption_model")
            feat_cols = get_features("disruption_features")
            model_version = "xgb_disruption_behavioural_v1"

        if model is None or feat_cols is None:
            logger.error("[risk] No disruption model available")
            # Fallback: Use a moderate probability to allow some triggers
            # This ensures the pipeline continues even when models aren't loaded
            return {
                "error": "Disruption model not available (using fallback)",
                "zone_risk_score": 0.55,  # Slightly higher to trigger some zones
                "fraud_risk_score": fraud_risk,
                "combined_disruption_probability": 0.55,  # 55% probability triggers at ~50% threshold
                "cached": False,
            }

        # ------------------------------------------------------------------ #
        # 4. Build feature dict
        # ------------------------------------------------------------------ #
        raw_dict = _build_disruption_feature_dict(db, worker_id)
        if not raw_dict:
            logger.warning(f"[risk] Empty feature dict for worker {worker_id}")
            return {
                "error": "Could not build feature dict — check worker data",
                "zone_risk_score": 0.5,
                "fraud_risk_score": fraud_risk,
                "combined_disruption_probability": 0.3,
                "cached": False,
            }

        # ------------------------------------------------------------------ #
        # 5. Align to training feature order, cast to float, fill NaN
        # ------------------------------------------------------------------ #
        X: pd.DataFrame = (
            pd.DataFrame([raw_dict])
            .reindex(columns=feat_cols, fill_value=0)
            .astype(float)
            .fillna(0)
        )

        # ------------------------------------------------------------------ #
        # 6. Predict disruption probability
        # ------------------------------------------------------------------ #
        try:
            proba = model.predict_proba(X)[0]
            # Binary classifier: index 1 is P(disruption=True)
            combined_prob = float(proba[1]) if len(proba) > 1 else float(proba[0])
        except AttributeError:
            # Regressor fallback (e.g. forecast model)
            combined_prob = float(model.predict(X)[0])

        combined_prob = float(np.clip(combined_prob, 0.0, 1.0))

        # ------------------------------------------------------------------ #
        # 6b. Apply decision thresholds
        # ------------------------------------------------------------------ #
        # Load the optimal cut-point for the model that was used
        if "realtime" in model_version:
            _thr = get_threshold("disruption_realtime_threshold")
            threshold = float(_thr) if _thr is not None else 0.998
        else:
            _thr = get_threshold("disruption_forecast_threshold")
            threshold = float(_thr) if _thr is not None else 0.631

        # trigger_active: True when probability crosses the trained threshold
        trigger_active = bool(combined_prob >= threshold)

        # risk_label: human-readable classification using forecast threshold bands
        _fc_thr = get_threshold("disruption_forecast_threshold")
        fc_threshold = float(_fc_thr) if _fc_thr is not None else 0.631
        if combined_prob >= fc_threshold:
            risk_label = "critical" if combined_prob >= 0.85 else "high"
        elif combined_prob >= fc_threshold * 0.65:
            risk_label = "medium"
        else:
            risk_label = "low"

        # ------------------------------------------------------------------ #
        # 7. Derive component event probabilities from raw signal values
        # ------------------------------------------------------------------ #
        rain = raw_dict.get("rainfall", 0.0)
        temp = raw_dict.get("temperature", 25.0)
        aqi = raw_dict.get("AQI", 0.0)

        # Rain: scales linearly with rainfall up to 300 mm reference maximum
        p_rain_event = float(np.clip((rain / 300.0) * combined_prob * 1.5, 0.0, 1.0))

        # Heat: activates above 35 °C; reference range 35–48 °C
        heat_factor = max(0.0, (float(temp) - 35.0) / 13.0)
        p_heat_event = float(np.clip(heat_factor * combined_prob * 0.5, 0.0, 1.0))

        # AQI: activates above 300; reference range 300–500
        aqi_factor = max(0.0, (float(aqi) - 300.0) / 200.0)
        p_aqi_event = float(np.clip(aqi_factor * combined_prob * 0.3, 0.0, 1.0))

        # ------------------------------------------------------------------ #
        # 8. Zone risk  (disruption prob × city-tier multiplier)
        # ------------------------------------------------------------------ #
        tier_mult = CITY_TIER_MULTIPLIERS[city_tier]
        zone_risk_score = float(np.clip(combined_prob * tier_mult, 0.0, 1.0))

        # ------------------------------------------------------------------ #
        # 9. Plan recommendation
        # ------------------------------------------------------------------ #
        if combined_prob >= 0.65:
            recommended_plan = "premium"
        elif combined_prob >= 0.40:
            recommended_plan = "standard"
        else:
            recommended_plan = "basic"

        # ------------------------------------------------------------------ #
        # 10. Build result, cache, and return
        # ------------------------------------------------------------------ #
        result = {
            "zone_risk_score": round(zone_risk_score, 4),
            "fraud_risk_score": round(fraud_risk, 4),
            "combined_disruption_probability": round(combined_prob, 4),
            "p_rain_event": round(p_rain_event, 4),
            "p_heat_event": round(p_heat_event, 4),
            "p_aqi_event": round(p_aqi_event, 4),
            "city_tier": city_tier,
            "recommended_plan": recommended_plan,
            "model_version": model_version,
            "trigger_active": trigger_active,
            "risk_label": risk_label,
            "decision_threshold": round(threshold, 6),
            "timestamp": datetime.utcnow().isoformat(),
            "cached": False,
        }

        WorkerCache.set_risk_score(worker_id, result)

        logger.info(
            f"[risk] worker={worker_id}  zone={zone_risk_score:.3f}  "
            f"fraud={fraud_risk:.3f}  disruption={combined_prob:.3f}  "
            f"tier={city_tier}  plan={recommended_plan}"
        )

        return result

    except Exception as exc:
        logger.error(
            f"[risk] compute_risk_score failed for worker {worker_id}: {exc}",
            exc_info=True,
        )
        return {
            "error": str(exc),
            "zone_risk_score": 0.5,
            "fraud_risk_score": 0.1,
            "combined_disruption_probability": 0.3,
            "cached": False,
        }


def compute_disruption_forecast(db: Session, worker_id: int) -> dict:
    """
    Behavioural disruption forecast using disruption_forecast_model.pkl (30 features).

    Unlike compute_risk_score, this model uses ONLY historical/behavioural features
    (temporal patterns, worker profile, activity history) with NO same-day sensor data.
    Suitable for 7-day-ahead forecasting where live IMD/CPCB data is not available.

    Uses disruption_forecast_threshold.pkl (0.631) as the decision boundary.
    Falls back to disruption_model.pkl (29 features) if the forecast model is unavailable.
    """
    try:
        # Cache check
        cached = WorkerCache.get_risk_score(f"forecast_{worker_id}")
        if cached is not None:
            cached["cached"] = True
            return cached

        worker: Worker = db.query(Worker).filter(Worker.worker_id == worker_id).first()
        if worker is None:
            return {
                "error": "Worker not found",
                "forecast_disruption_probability": 0.3,
                "cached": False,
            }

        fraud_risk = float(worker.fraud_risk_score or 0.0)
        city_tier = get_city_tier(worker.city or "")

        # Try forecast model first, then fall back to behavioural model
        model = get_model("disruption_forecast_model")
        feat_cols = get_features("disruption_forecast_features")
        model_version = "xgb_disruption_forecast_v1"

        if model is None or feat_cols is None:
            logger.warning(
                "[risk] Forecast model unavailable; falling back to behavioural model"
            )
            model = get_model("disruption_model")
            feat_cols = get_features("disruption_features")
            model_version = "xgb_disruption_behavioural_v1"

        if model is None or feat_cols is None:
            return {
                "error": "Neither forecast nor behavioural model is available",
                "forecast_disruption_probability": 0.3,
                "cached": False,
            }

        raw_dict = _build_disruption_feature_dict(db, worker_id)
        if not raw_dict:
            return {
                "error": "Could not build feature dict — check worker data",
                "forecast_disruption_probability": 0.3,
                "cached": False,
            }

        X: pd.DataFrame = (
            pd.DataFrame([raw_dict])
            .reindex(columns=feat_cols, fill_value=0)
            .astype(float)
            .fillna(0)
        )

        try:
            proba = model.predict_proba(X)[0]
            forecast_prob = float(
                np.clip(proba[1] if len(proba) > 1 else proba[0], 0.0, 1.0)
            )
        except AttributeError:
            forecast_prob = float(np.clip(model.predict(X)[0], 0.0, 1.0))

        # Apply forecast threshold
        _fc_thr = get_threshold("disruption_forecast_threshold")
        threshold = float(_fc_thr) if _fc_thr is not None else 0.631

        trigger_predicted = bool(forecast_prob >= threshold)

        if forecast_prob >= 0.85:
            risk_label = "critical"
        elif forecast_prob >= threshold:
            risk_label = "high"
        elif forecast_prob >= threshold * 0.65:
            risk_label = "medium"
        else:
            risk_label = "low"

        tier_mult = CITY_TIER_MULTIPLIERS.get(city_tier, 1.0)

        # Component-level forward probabilities (derived)
        # Since this is a behavioural model, these are soft estimates
        p_rain_fwd = float(np.clip(forecast_prob * 0.55, 0.0, 1.0))
        p_heat_fwd = float(np.clip(forecast_prob * 0.25, 0.0, 1.0))
        p_aqi_fwd = float(np.clip(forecast_prob * 0.20, 0.0, 1.0))

        result = {
            "worker_id": worker_id,
            "forecast_disruption_probability": round(forecast_prob, 4),
            "trigger_predicted": trigger_predicted,
            "risk_label": risk_label,
            "forecast_threshold": round(threshold, 6),
            "p_rain_forward": round(p_rain_fwd, 4),
            "p_heat_forward": round(p_heat_fwd, 4),
            "p_aqi_forward": round(p_aqi_fwd, 4),
            "city_tier": city_tier,
            "city_multiplier": float(tier_mult),
            "fraud_risk_score": round(fraud_risk, 4),
            "model_version": model_version,
            "model_type": "behavioural_forecast",
            "note": "Behavioural forecast — no live sensor data required",
            "timestamp": datetime.utcnow().isoformat(),
            "cached": False,
        }

        WorkerCache.set_risk_score(f"forecast_{worker_id}", result)
        logger.info(
            "[risk/forecast] worker=%s  prob=%.4f  trigger=%s  label=%s  model=%s",
            worker_id,
            forecast_prob,
            trigger_predicted,
            risk_label,
            model_version,
        )
        return result

    except Exception as exc:
        logger.error(
            "[risk] compute_disruption_forecast failed: %s", exc, exc_info=True
        )
        return {
            "error": str(exc),
            "forecast_disruption_probability": 0.3,
            "trigger_predicted": False,
            "risk_label": "low",
            "cached": False,
        }


def compute_disruption_behavioural(db: Session, worker_id: int) -> dict:
    """
    Pure behavioural disruption model — disruption_model.pkl (29 features).

    Uses worker profile + delivery activity patterns only (no weather, no AQI).
    Designed to assess a worker's inherent disruption vulnerability based on
    their behaviour, platform, zone, and experience — independent of current conditions.
    """
    try:
        worker: Worker = db.query(Worker).filter(Worker.worker_id == worker_id).first()
        if worker is None:
            return {
                "error": "Worker not found",
                "behavioural_disruption_score": 0.2,
                "cached": False,
            }

        city_tier = get_city_tier(worker.city or "")
        fraud_risk = float(worker.fraud_risk_score or 0.0)

        model = get_model("disruption_model")
        feat_cols = get_features("disruption_features")

        if model is None or feat_cols is None:
            return {
                "error": "Behavioural disruption model not available",
                "behavioural_disruption_score": 0.2,
                "cached": False,
            }

        raw_dict = _build_disruption_feature_dict(db, worker_id)
        if not raw_dict:
            return {
                "error": "Could not build feature dict",
                "behavioural_disruption_score": 0.2,
                "cached": False,
            }

        X: pd.DataFrame = (
            pd.DataFrame([raw_dict])
            .reindex(columns=feat_cols, fill_value=0)
            .astype(float)
            .fillna(0)
        )

        try:
            proba = model.predict_proba(X)[0]
            score = float(np.clip(proba[1] if len(proba) > 1 else proba[0], 0.0, 1.0))
        except AttributeError:
            score = float(np.clip(model.predict(X)[0], 0.0, 1.0))

        # Use forecast threshold as reference (no dedicated threshold for this model)
        _thr = get_threshold("disruption_forecast_threshold")
        threshold = float(_thr) if _thr is not None else 0.631

        if score >= 0.80:
            vulnerability = "high"
        elif score >= 0.50:
            vulnerability = "medium"
        else:
            vulnerability = "low"

        result = {
            "worker_id": worker_id,
            "behavioural_disruption_score": round(score, 4),
            "vulnerability_label": vulnerability,
            "city_tier": city_tier,
            "city_multiplier": float(CITY_TIER_MULTIPLIERS.get(city_tier, 1.0)),
            "fraud_risk_score": round(fraud_risk, 4),
            "model_version": "xgb_disruption_behavioural_v1",
            "n_features": int(getattr(model, "n_features_in_", 29)),
            "note": "Pure behavioural model — no live environmental data",
            "timestamp": datetime.utcnow().isoformat(),
        }

        logger.info(
            "[risk/behavioural] worker=%s  score=%.4f  vulnerability=%s",
            worker_id,
            score,
            vulnerability,
        )
        return result

    except Exception as exc:
        logger.error(
            "[risk] compute_disruption_behavioural failed: %s", exc, exc_info=True
        )
        return {"error": str(exc), "behavioural_disruption_score": 0.2}
