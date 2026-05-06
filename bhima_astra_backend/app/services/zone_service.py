import logging

from app.db.models.daily_operations import DailyOperation
from app.db.models.manager_flags import ManagerDisruptionFlag
from app.db.models.worker import Worker
from app.ml.risk_inference import compute_risk_score
from app.utils.cache_manager import ZoneCache
from sqlalchemy.orm import Session

logger = logging.getLogger("bhima.zone_service")


def compute_zone_live_data(db: Session, zone_id: str):
    """
    Compute zone-level live disruption data using ML risk predictions.

    Uses XGBoost risk model to predict zone disruption probability instead of simple averages.
    Integrates ML predictions for accurate, adaptive zone-level decision making.
    """

    # 🔥 Get all workers in zone with their latest operations
    ops = (
        db.query(DailyOperation)
        .join(Worker, Worker.worker_id == DailyOperation.worker_id)
        .filter(Worker.geo_zone_id == zone_id)
        .all()
    )

    if not ops:
        return {
            "zone_id": zone_id,
            "zone_risk_score": 0.0,
            "disruption_probability": 0.0,
            "disruption_events": 0,
            "manager_flags": 0,
            "trigger_recommended": False,
            "worker_count": 0,
        }

    # 🔥 COMPUTE ZONE-LEVEL RISK using ML models
    # For each worker in zone, get their risk score via XGBoost
    zone_risk_scores = []
    disruption_probs = []

    try:
        workers_in_zone = db.query(Worker).filter(Worker.geo_zone_id == zone_id).all()

        for worker in workers_in_zone:
            try:
                risk_data = compute_risk_score(db, worker.worker_id)
                zone_risk_scores.append(risk_data.get("zone_risk_score", 0))
                disruption_probs.append(
                    risk_data.get("combined_disruption_probability", 0)
                )
            except Exception as e:
                logger.warning(
                    f"[ZONE-ML] Failed to compute risk for worker {worker.worker_id}: {e}"
                )
                continue

        # Aggregate zone-level scores (weighted average)
        if zone_risk_scores:
            avg_zone_risk = sum(zone_risk_scores) / len(zone_risk_scores)
            avg_disruption_prob = sum(disruption_probs) / len(disruption_probs)
        else:
            avg_zone_risk = 0.0
            avg_disruption_prob = 0.0

    except Exception as e:
        logger.error(f"[ZONE-ML] ML risk computation failed for zone {zone_id}: {e}")
        avg_zone_risk = 0.0
        avg_disruption_prob = 0.0

    disruption_count = sum(1 for o in ops if o.disruption_flag)

    # 🔹 manager signals
    flags = (
        db.query(ManagerDisruptionFlag)
        .filter(
            ManagerDisruptionFlag.zone_id == zone_id,
            ManagerDisruptionFlag.admin_verified == True,
        )
        .all()
    )

    manager_signal = len(flags)

    # 🔥 ZONE TRIGGER RECOMMENDATION: Use ML threshold logic
    # Zone triggers when: disruption_prob > 0.50 OR zone_risk > 0.65
    trigger_threshold_prob = 0.50
    trigger_threshold_risk = 0.65
    trigger_recommended = (avg_disruption_prob >= trigger_threshold_prob) or (
        avg_zone_risk > trigger_threshold_risk
    )

    logger.info(
        f"[ZONE-ML] zone={zone_id}, disruption_prob={avg_disruption_prob:.3f}, "
        f"zone_risk={avg_zone_risk:.3f}, trigger={trigger_recommended}"
    )

    # 🔥 BUILD RESULT
    result = {
        "zone_id": zone_id,
        "zone_risk_score": round(avg_zone_risk, 3),
        "disruption_probability": round(avg_disruption_prob, 3),
        "disruption_events": disruption_count,
        "manager_flags": manager_signal,
        "trigger_recommended": trigger_recommended,
        "worker_count": len(workers_in_zone) if "workers_in_zone" in locals() else 0,
    }

    # 🔥 CACHE THE RESULT (5 min TTL)
    ZoneCache.set_live_data(zone_id, result)

    return result


import json

from app.utils.redis_client import redis_client


def get_zone_live_cached(db, zone_id: str):
    cache_key = f"zone_live:{zone_id}"

    # 🔹 1. Try Redis — gracefully skip if Redis is unavailable
    try:
        cached = redis_client.get(cache_key)
        if cached:
            return json.loads(cached)
    except Exception as e:
        logger.debug(f"[CACHE] Redis unavailable, skipping zone live cache: {e}")

    # 🔹 2. Compute from DB
    data = compute_zone_live_data(db, zone_id)

    # 🔹 3. Store in Redis — gracefully skip if Redis is unavailable
    try:
        redis_client.setex(cache_key, 300, json.dumps(data))
    except Exception as e:
        logger.debug(f"[CACHE] Failed to write zone live cache: {e}")

    return data


from app.db.models.forecast import WeeklyForecastCache


def get_zone_forecast(db, zone_id: str):
    # 🔥 CHECK CACHE FIRST (1 hour TTL for forecasts)
    try:
        cached_forecast = ZoneCache.get_forecast(zone_id)
        if cached_forecast:
            cached_forecast["cached"] = True
            return cached_forecast
    except Exception:
        pass

    records = (
        db.query(WeeklyForecastCache)
        .filter(WeeklyForecastCache.zone_id == zone_id)
        .order_by(WeeklyForecastCache.forecast_date.asc())
        .limit(7)
        .all()
    )

    if not records:
        result = {"zone_id": zone_id, "forecast": [], "cached": False}
        return result

    result = {
        "zone_id": zone_id,
        "forecast": [
            {
                "forecast_date": str(r.forecast_date),  # always str
                "p_rain": float(r.p_rain) if r.p_rain is not None else 0.0,
                "p_heat": float(r.p_heat) if r.p_heat is not None else 0.0,
                "p_aqi": float(r.p_aqi) if r.p_aqi is not None else 0.0,
                "composite_risk": float(r.composite_risk)
                if r.composite_risk is not None
                else 0.0,
                "risk_label": r.risk_label or "low",
            }
            for r in records
        ],
        "cached": False,
    }

    # 🔥 CACHE THE FORECAST — skip if Redis unavailable
    try:
        ZoneCache.set_forecast(zone_id, result)
    except Exception as e:
        logger.debug(f"[CACHE] Failed to cache zone forecast: {e}")

    return result


from app.db.models.daily_operations import DailyOperation
from app.db.models.worker import Worker
from sqlalchemy import func, text


def get_zone_history(db, zone_id: str, days: int = 7):
    # 🔥 CHECK CACHE FIRST (2 hour TTL for historical data - changes infrequently)
    cache_key_suffix = f"_{days}d" if days != 7 else ""
    cached_history = ZoneCache.get_history(zone_id)
    if cached_history:
        cached_history["cached"] = True
        return cached_history

    records = db.execute(
        text("""
    SELECT
        d.date,
        ROUND(AVG(d.composite_score)::numeric, 3) AS avg_risk,
        SUM(CASE WHEN d.disruption_flag = true THEN 1 ELSE 0 END) AS disruption_events,
        ROUND(AVG(d.income_loss)::numeric, 2) AS avg_income_loss
    FROM daily_operations d
    JOIN workers w
        ON w.worker_id = d.worker_id
    WHERE w.geo_zone_id = :zone_id
    GROUP BY d.date
    ORDER BY d.date DESC
    LIMIT :days
"""),
        {"zone_id": zone_id, "days": days},
    ).fetchall()

    result = {
        "zone_id": zone_id,
        "history": [
            {
                "date": str(r[0]),
                "avg_risk": float(r[1]),
                "disruption_events": int(r[2]),
                "avg_income_loss": float(r[3]),
            }
            for r in records
        ],
        "cached": False,
    }

    # 🔥 CACHE THE HISTORY
    ZoneCache.set_history(zone_id, result)
    return result


from sqlalchemy import text


def get_zone_dashboard(db, zone_id: str):
    result = db.execute(
        text("""
        SELECT
            z.zone_id,
            z.composite_score,
            z.aqi,
            z.rainfall,

            f.composite_risk,
            f.risk_label,

            COUNT(m.flag_id) FILTER (WHERE m.flag_status = 'verified') AS active_flags,
            BOOL_OR(m.payout_enabled) AS payout_enabled,

            COUNT(DISTINCT w.worker_id) AS worker_count

        FROM zone_live_cache z

        LEFT JOIN weekly_forecast_cache f
            ON z.zone_id = f.zone_id

        LEFT JOIN manager_disruption_flags m
            ON z.zone_id = m.zone_id

        LEFT JOIN workers w
            ON w.geo_zone_id = z.zone_id

        WHERE z.zone_id = :zone_id

        GROUP BY
            z.zone_id, z.composite_score, z.aqi, z.rainfall,
            f.composite_risk, f.risk_label
    """),
        {"zone_id": zone_id},
    ).fetchone()

    if not result:
        return {"error": "Zone not found"}

    # 🔥 DECISION LOGIC
    decision = "NORMAL"

    if result.composite_score and result.composite_score > 0.6:
        decision = "HIGH_RISK"

    if result.composite_risk and result.composite_risk > 0.6:
        decision = "HIGH_RISK"

    if result.active_flags and result.active_flags > 0 and result.payout_enabled:
        decision = "AUTO_TRIGGER_PAYOUT"

    return {
        "zone": result.zone_id,
        "live": {
            "composite_score": result.composite_score,
            "aqi": result.aqi,
            "rainfall": result.rainfall,
        },
        "forecast": {"risk": result.composite_risk, "label": result.risk_label},
        "disruptions": {
            "active_flags": result.active_flags,
            "payout_enabled": result.payout_enabled,
        },
        "workers": {"count": result.worker_count},
        "decision": decision,
    }
