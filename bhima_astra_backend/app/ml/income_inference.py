"""
Income Prediction Inference — XGBRegressor Model

Predicts expected daily income (₹/day) for a gig worker using a trained
XGBRegressor model (income_model.pkl) with 50 features aligned via
income_features.pkl.

Results are cached in Redis with a 10-minute TTL.
"""

import logging
from datetime import datetime, timedelta

import numpy as np
import pandas as pd
from app.db.models.daily_operations import DailyOperation
from app.db.models.worker import Worker
from app.ml.model_loader import get_encoder, get_features, get_model
from app.utils.cache_manager import WorkerCache
from sqlalchemy.orm import Session

logger = logging.getLogger("bhima.ml.income_inference")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _safe_encode(encoder, value, default: int = 0) -> int:
    """
    Safely label-encode a single value with a fitted LabelEncoder.

    Returns *default* when the encoder is None, the value is None,
    or the value is unseen by the encoder.
    """
    try:
        if encoder is None or value is None:
            return default
        return int(encoder.transform([str(value)])[0])
    except Exception:
        return default


# ---------------------------------------------------------------------------
# Internal feature builder
# ---------------------------------------------------------------------------


def _build_income_feature_dict(db: Session, worker_id: int) -> dict:
    """
    Build the complete 50-feature dict required by the income model.

    Feature groups
    --------------
    • 34  from the latest DailyOperation row (direct ORM columns + boolean casts)
    • 2   derived from the operation date (month, ISO week)
    • 11  from the Worker row, with label-encoded categorical columns
    • 3   derived composites  (weather_stress, orders_std, active_days_ratio)

    Returns an empty dict on any unrecoverable error.
    """
    try:
        # ------------------------------------------------------------------ #
        # 1. Worker lookup
        # ------------------------------------------------------------------ #
        worker: Worker = db.query(Worker).filter(Worker.worker_id == worker_id).first()
        if worker is None:
            logger.warning(f"[income] Worker {worker_id} not found")
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
            logger.warning(f"[income] No DailyOperation records for worker {worker_id}")
            return {}

        # ------------------------------------------------------------------ #
        # 3. Last-30-days ops for derived features
        # ------------------------------------------------------------------ #
        cutoff_30d = datetime.utcnow().date() - timedelta(days=30)
        ops_30d = (
            db.query(DailyOperation)
            .filter(
                DailyOperation.worker_id == worker_id,
                DailyOperation.date >= cutoff_30d,
            )
            .all()
        )

        # orders_std: population std of orders_per_day over last 30 days
        order_counts = [
            op.orders_per_day for op in ops_30d if op.orders_per_day is not None
        ]
        orders_std = (
            float(np.std(order_counts, ddof=0)) if len(order_counts) > 1 else 0.0
        )

        # active_days_ratio: fraction of records where disruption_flag is True
        if ops_30d:
            active_days_ratio = sum(1 for op in ops_30d if op.disruption_flag) / len(
                ops_30d
            )
        else:
            active_days_ratio = 0.0

        # ------------------------------------------------------------------ #
        # 4. Encoders
        # ------------------------------------------------------------------ #
        encoders: dict = get_encoder("workers_encoders") or {}

        # ------------------------------------------------------------------ #
        # 5. Convenience aliases & derived scalars
        # ------------------------------------------------------------------ #
        op = latest_op
        rain = float(op.rainfall or 0.0)
        aqi_val = float(op.aqi or 0.0)
        traffic_val = float(op.traffic_index or 0.0)

        weather_stress = (
            0.4 * (rain / 300.0) + 0.3 * (aqi_val / 500.0) + 0.3 * (traffic_val / 100.0)
        )

        # ------------------------------------------------------------------ #
        # 6. Assemble raw dict (50 keys)
        # ------------------------------------------------------------------ #
        raw: dict = {
            # ---- 34 × DailyOperation columns ----
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
            "AQI": aqi_val,  # op.aqi  → AQI
            "traffic_index": traffic_val,
            "flood_alert": int(bool(op.flood_alert)),
            "wind_speed": float(op.wind_speed or 0.0),
            "road_closure_flag": int(bool(op.road_closure_flag)),
            "R_norm": float(op.r_norm or 0.0),  # op.r_norm    → R_norm
            "AQI_norm": float(op.aqi_norm or 0.0),  # op.aqi_norm  → AQI_norm
            "Traffic_norm": float(
                op.traffic_norm or 0.0
            ),  # op.traffic_norm → Traffic_norm
            "composite_score": float(op.composite_score or 0.0),
            "composite_threshold": float(op.composite_threshold or 0.0),
            "platform_outage": int(bool(op.platform_outage)),
            "zone_shutdown": int(bool(op.zone_shutdown)),
            "curfew_flag": int(bool(op.curfew_flag)),
            "strike_flag": int(bool(op.strike_flag)),
            "disruption_flag": int(bool(op.disruption_flag)),
            "sudden_income_spike": int(bool(op.sudden_income_spike)),
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
            # ---- 3 × derived composites ----
            "weather_stress": float(weather_stress),
            "orders_std": float(orders_std),
            "active_days_ratio": float(active_days_ratio),
        }

        return raw

    except Exception as exc:
        logger.error(
            f"[income] Error building feature dict for worker {worker_id}: {exc}",
            exc_info=True,
        )
        return {}


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def predict_income(db: Session, worker_id: int) -> dict:
    """
    Predict expected daily income for a worker using the XGBRegressor.

    The prediction is aligned to the exact training-time feature order via
    income_features.pkl, so column additions / removals in raw_dict are safe.

    Results are cached in Redis for 10 minutes.

    Parameters
    ----------
    db : Session
        Active SQLAlchemy session.
    worker_id : int
        Primary key of the worker.

    Returns
    -------
    dict with keys:
        expected_income          – daily income prediction in ₹
        income_baseline_weekly   – 7 × daily projection
        model_version            – model identifier string
        features_used            – number of features in the model
        timestamp                – ISO-8601 UTC string
        cached                   – True if result came from Redis
        error                    – present only on failure
    """
    try:
        # ------------------------------------------------------------------ #
        # 1. Cache check  (10-minute TTL)
        # ------------------------------------------------------------------ #
        cached = WorkerCache.get_income_prediction(worker_id)
        if cached is not None:
            cached["cached"] = True
            return cached

        # ------------------------------------------------------------------ #
        # 2. Load model + feature list
        # ------------------------------------------------------------------ #
        model = get_model("income_model")
        if model is None:
            logger.error("[income] income_model not loaded")
            return {
                "error": "Income model not available",
                "expected_income": 0.0,
                "income_baseline_weekly": 0.0,
                "cached": False,
            }

        feat_cols = get_features("income_features")
        if feat_cols is None:
            logger.error("[income] income_features not loaded")
            return {
                "error": "Income feature list not available",
                "expected_income": 0.0,
                "income_baseline_weekly": 0.0,
                "cached": False,
            }

        # ------------------------------------------------------------------ #
        # 3. Build feature dict
        # ------------------------------------------------------------------ #
        raw_dict = _build_income_feature_dict(db, worker_id)
        if not raw_dict:
            logger.warning(f"[income] Empty feature dict for worker {worker_id}")
            return {
                "error": "Could not build feature dict — check worker data",
                "expected_income": 0.0,
                "income_baseline_weekly": 0.0,
                "cached": False,
            }

        # ------------------------------------------------------------------ #
        # 4. Align to training feature order, cast to float, fill NaN
        # ------------------------------------------------------------------ #
        X: pd.DataFrame = (
            pd.DataFrame([raw_dict])
            .reindex(columns=feat_cols, fill_value=0)
            .astype(float)
            .fillna(0)
        )

        # ------------------------------------------------------------------ #
        # 5. Predict and clamp
        # ------------------------------------------------------------------ #
        expected_daily = float(model.predict(X)[0])
        expected_daily = max(0.0, expected_daily)  # no negative income
        income_baseline_weekly = round(expected_daily * 7.0, 2)
        expected_daily = round(expected_daily, 2)

        # ------------------------------------------------------------------ #
        # 6. Build result and cache it
        # ------------------------------------------------------------------ #
        result = {
            "expected_income": expected_daily,
            "income_baseline_weekly": income_baseline_weekly,
            "model_version": "xgb_income_v1",
            "features_used": len(feat_cols),
            "timestamp": datetime.utcnow().isoformat(),
            "cached": False,
        }

        WorkerCache.set_income_prediction(worker_id, result)

        logger.info(
            f"[income] worker={worker_id} "
            f"daily=₹{expected_daily:.2f}  weekly=₹{income_baseline_weekly:.2f}"
        )
        return result

    except Exception as exc:
        logger.error(
            f"[income] Prediction failed for worker {worker_id}: {exc}",
            exc_info=True,
        )
        return {
            "error": str(exc),
            "expected_income": 0.0,
            "income_baseline_weekly": 0.0,
            "cached": False,
        }


def predict_income_loss(
    db: Session,
    worker_id: int,
    disruption_severity: float = 1.0,
) -> dict:
    """
    Estimate daily income loss caused by a disruption event.

    A full disruption is assumed to reduce income by 60 %. The
    *disruption_severity* multiplier scales this fraction:
      •  1.0  → Tier-1 baseline (60 % loss)
      •  1.3  → Tier-2 adjustment
      •  1.6  → Tier-3 adjustment

    Parameters
    ----------
    db : Session
    worker_id : int
    disruption_severity : float
        Multiplicative factor in [0, 1.6]. Defaults to 1.0.

    Returns
    -------
    dict with keys:
        income_loss              – projected daily loss in ₹
        income_loss_pct          – loss as a percentage of baseline
        affected_days_week       – estimated days affected per week
        expected_income_daily    – raw daily baseline from predict_income
        error                    – present only on failure
    """
    try:
        income_pred = predict_income(db, worker_id)
        expected_daily = float(income_pred.get("expected_income", 0.0))

        base_loss_pct = 0.60
        income_loss = expected_daily * base_loss_pct * disruption_severity
        affected_days = max(1.0, 7.0 * disruption_severity)

        return {
            "income_loss": round(income_loss, 2),
            "income_loss_pct": round(base_loss_pct * 100.0 * disruption_severity, 2),
            "affected_days_week": round(affected_days, 2),
            "expected_income_daily": round(expected_daily, 2),
        }

    except Exception as exc:
        logger.error(
            f"[income] Income-loss prediction failed for worker {worker_id}: {exc}",
            exc_info=True,
        )
        return {
            "error": str(exc),
            "income_loss": 0.0,
            "income_loss_pct": 0.0,
        }
