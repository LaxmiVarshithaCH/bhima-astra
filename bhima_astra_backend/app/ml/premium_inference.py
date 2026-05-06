"""
Premium Calculation Inference — Ridge Regression Model
=======================================================
Formula : Weekly_Premium = E[L] + Expense_Loading (10-15%) + Risk_Margin (20-30%)
E[L]    : P_disruption × (Ŷ_income × S_event × 7 days × 0.60 loss-ratio)

Training features (11, aggregated per worker from daily_operations):
  actual_income, income_loss, disruption_flag, composite_score,
  rainfall, AQI, experience_level, shift_hours,
  fraud_risk_score, kyc_verified, bank_verified

The Ridge model predicts a continuous premium value in [49, 119].
Result is clamped to the nearest plan-tier band (±20 % of base rate).
"""

import logging
import warnings
from datetime import datetime, timedelta
from typing import Optional

import numpy as np
import pandas as pd
from app.db.models.daily_operations import DailyOperation
from app.db.models.worker import Worker
from app.ml.model_loader import (
    get_features,
    get_model,
    get_scaler,
    load_features,
    load_model,
    load_scaler,
)
from app.utils.cache_manager import PremiumCache
from sqlalchemy.orm import Session

logger = logging.getLogger("bhima.ml.premium_inference")

# ---------------------------------------------------------------------------
# City / tier configuration (mirrors risk_inference.py)
# ---------------------------------------------------------------------------

CITY_TIER_MAP = {
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

CITY_TIER_MULTIPLIERS = {1: 1.2, 2: 1.0, 3: 0.85}
SEVERITY_MULTIPLIERS = {1: 1.0, 2: 1.3, 3: 1.6}


def get_city_tier(city_name: str) -> int:
    return CITY_TIER_MAP.get((city_name or "").lower().strip(), 3)


# ---------------------------------------------------------------------------
# Plan-tier configuration
# ---------------------------------------------------------------------------

BASE_PREMIUMS = {"basic": 49, "standard": 79, "premium": 119}

# ±20 % clamp around each base
PLAN_BANDS = {
    "basic": {"min": 39, "max": 59},
    "standard": {"min": 63, "max": 95},
    "premium": {"min": 95, "max": 143},
}

# Payout rates per plan per severity level (Tier-2 baseline)
PAYOUT_RATES_BASE = {
    "basic": {"L1": 300, "L2": 300, "L3": 600},
    "standard": {"L1": 400, "L2": 600, "L3": 800},
    "premium": {"L1": 600, "L2": 900, "L3": 1200},
}


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _safe_float(val, default: float = 0.0) -> float:
    try:
        return float(val) if val is not None else default
    except (TypeError, ValueError):
        return default


def _build_premium_feature_dict(
    db: Session,
    worker: Worker,
    lookback_days: int = 90,
) -> dict:
    """
    Aggregate worker's recent daily_operations into the 11 premium features.

    The Ridge model was trained on per-worker aggregates (mean of each column).
    We replicate that here by averaging the last *lookback_days* operations.
    """
    cutoff = datetime.utcnow() - timedelta(days=lookback_days)
    ops = (
        db.query(DailyOperation)
        .filter(
            DailyOperation.worker_id == worker.worker_id,
            DailyOperation.date >= cutoff,
        )
        .all()
    )

    if not ops:
        # Fall back to worker-level defaults — all numeric fields are 0
        return {
            "actual_income": 0.0,
            "income_loss": 0.0,
            "disruption_flag": 0.0,
            "composite_score": 0.0,
            "rainfall": 0.0,
            "AQI": 100.0,
            "experience_level": _safe_float(worker.experience_level, 1.0),
            "shift_hours": _safe_float(worker.shift_hours, 8.0),
            "fraud_risk_score": _safe_float(worker.fraud_risk_score, 0.1),
            "kyc_verified": int(bool(worker.kyc_verified)),
            "bank_verified": int(bool(worker.bank_verified)),
        }

    # Aggregation (mirrors training: groupby worker_id + .mean() / .first())
    n = len(ops)

    def _mean(attr: str) -> float:
        vals = [_safe_float(getattr(op, attr, None)) for op in ops]
        return float(np.mean(vals)) if vals else 0.0

    actual_income = _mean("actual_income")
    income_loss = _mean("income_loss")
    disruption_flag = _mean("disruption_flag")  # proportion of days disrupted
    composite_score = _mean("composite_score")
    rainfall = _mean("rainfall")
    aqi = _mean("aqi")  # DB col is lowercase

    return {
        "actual_income": actual_income,
        "income_loss": income_loss,
        "disruption_flag": disruption_flag,
        "composite_score": composite_score,
        "rainfall": rainfall,
        "AQI": aqi,  # model feature name is uppercase
        "experience_level": _safe_float(worker.experience_level, 1.0),
        "shift_hours": _safe_float(worker.shift_hours, 8.0),
        "fraud_risk_score": _safe_float(worker.fraud_risk_score, 0.1),
        "kyc_verified": int(bool(worker.kyc_verified)),
        "bank_verified": int(bool(worker.bank_verified)),
    }


# ---------------------------------------------------------------------------
# Premium feature names  (must match premium_features.pkl order)
# ---------------------------------------------------------------------------

PREMIUM_FEATURE_NAMES = [
    "actual_income",
    "income_loss",
    "disruption_flag",
    "composite_score",
    "rainfall",
    "AQI",
    "experience_level",
    "shift_hours",
    "fraud_risk_score",
    "kyc_verified",
    "bank_verified",
]


def _ridge_predict(feature_dict: dict) -> Optional[float]:
    """
    Scale features and run Ridge model.  Returns predicted premium or None.
    """
    model = get_model("premium_model") or load_model("premium_model")
    scaler = get_scaler("premium_scaler") or load_scaler("premium_scaler")

    if model is None:
        logger.warning("Premium Ridge model not loaded — using actuarial fallback")
        return None

    # Use saved feature list from premium_features.pkl for exact alignment
    feat_cols = get_features("premium_features")
    if feat_cols is None:
        feat_cols = load_features("premium_features")
    if feat_cols is None:
        feat_cols = PREMIUM_FEATURE_NAMES  # hardcoded fallback

    feat_cols = list(feat_cols)

    row = (
        pd.DataFrame([feature_dict])
        .reindex(columns=feat_cols, fill_value=0.0)
        .astype(float)
        .fillna(0.0)
    )

    if scaler is not None:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            X = scaler.transform(row)
    else:
        logger.warning("Premium scaler not loaded — predicting without scaling")
        X = row.values

    pred = float(model.predict(X)[0])
    return pred


# ---------------------------------------------------------------------------
# Actuarial E[L] formula (used both as the premium floor and in fallback mode)
# ---------------------------------------------------------------------------


def _expected_loss(
    income_daily: float,
    disruption_prob: float,
    severity_factor: float = 1.0,
) -> float:
    """E[L_weekly] = P_disruption × (Ŷ_income × 7 × S_event × 0.60)."""
    return disruption_prob * (income_daily * 7.0 * severity_factor * 0.60)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def calculate_premium(
    db: Session,
    worker_id: int,
    plan_tier: Optional[str] = None,
) -> dict:
    """
    Calculate personalised weekly premium.

    Priority:
      1. Ridge model prediction (scaled by city multiplier)
      2. Actuarial formula fallback if model unavailable

    Premium is clamped within ±20 % of the plan tier base rate.
    """
    try:
        # ── Cache check ────────────────────────────────────────────────────
        _cache_tier = (plan_tier or "auto").lower().strip()
        _cached = PremiumCache.get(worker_id, _cache_tier)
        if _cached is not None:
            _cached["cached"] = True
            return _cached

        # ── Fetch worker ─────────────────────────────────────────────────────
        worker = db.query(Worker).filter(Worker.worker_id == worker_id).first()
        if not worker:
            logger.error(f"Worker {worker_id} not found")
            return {
                "error": "Worker not found",
                "personalized_premium": 79,
                "base_premium": 79,
            }

        city_tier = get_city_tier(worker.city or "")
        city_multiplier = CITY_TIER_MULTIPLIERS.get(city_tier, 1.0)
        severity_mult = SEVERITY_MULTIPLIERS.get(city_tier, 1.0)

        # ── Build feature dict from DB ────────────────────────────────────────
        feat_dict = _build_premium_feature_dict(db, worker)

        # ── Ridge model prediction ────────────────────────────────────────────
        ridge_pred = _ridge_predict(feat_dict)

        # ── Determine plan tier ───────────────────────────────────────────────
        if plan_tier is None:
            # Derive from Ridge prediction or income-based heuristic
            income_daily = _safe_float(feat_dict.get("actual_income"), 1000.0)
            disruption_p = _safe_float(feat_dict.get("disruption_flag"), 0.30)
            el = _expected_loss(income_daily, disruption_p, severity_mult)
            raw = el * 1.35
            if ridge_pred is not None:
                raw = ridge_pred
            if raw <= 60 or income_daily < 900:
                plan_tier = "basic"
            elif raw <= 95 or income_daily < 1300:
                plan_tier = "standard"
            else:
                plan_tier = "premium"

        plan_tier = plan_tier.lower().strip()
        if plan_tier not in PLAN_BANDS:
            plan_tier = "standard"

        base_premium = BASE_PREMIUMS[plan_tier]
        base_premium_adjusted = base_premium * city_multiplier

        # ── Compute personalized premium ──────────────────────────────────────
        if ridge_pred is not None:
            # Ridge was trained on Tier-2 baseline data → apply city multiplier
            personalized_premium = ridge_pred * city_multiplier
        else:
            # Actuarial fallback
            income_daily = _safe_float(feat_dict.get("actual_income"), 1000.0)
            disruption_p = _safe_float(feat_dict.get("disruption_flag"), 0.30)
            el = _expected_loss(income_daily, disruption_p, severity_mult)
            personalized_premium = el * 1.35 * city_multiplier

        # ── Clamp within plan band ────────────────────────────────────────────
        band = PLAN_BANDS[plan_tier]
        personalized_premium = max(band["min"], min(band["max"], personalized_premium))

        # ── Expected loss for audit ───────────────────────────────────────────
        income_d = _safe_float(feat_dict.get("actual_income"), 1000.0)
        disrupt_p = _safe_float(feat_dict.get("disruption_flag"), 0.30)
        el_weekly = _expected_loss(income_d, disrupt_p, severity_mult)
        expense_loading = el_weekly * 0.10
        risk_margin = el_weekly * 0.25

        # ── City-adjusted payout amounts ──────────────────────────────────────
        payout_l1 = PAYOUT_RATES_BASE[plan_tier]["L1"] * city_multiplier
        payout_l2 = PAYOUT_RATES_BASE[plan_tier]["L2"] * city_multiplier
        payout_l3 = PAYOUT_RATES_BASE[plan_tier]["L3"] * city_multiplier

        # Apply severity multiplier for Tier-2/3 cities
        if city_tier > 1:
            payout_l1 *= severity_mult
            payout_l2 *= severity_mult
            payout_l3 *= severity_mult

        logger.info(
            f"Premium calc — worker={worker_id} plan={plan_tier} "
            f"base={base_premium:.0f} personalized={personalized_premium:.2f} "
            f"tier={city_tier} multiplier={city_multiplier}"
        )

        result = {
            "plan_tier": plan_tier,
            "base_premium": float(base_premium),
            "base_premium_adjusted": float(base_premium_adjusted),
            "personalized_premium": round(float(personalized_premium), 2),
            "expected_loss": round(float(el_weekly), 2),
            "expense_loading": round(float(expense_loading), 2),
            "risk_margin": round(float(risk_margin), 2),
            "city_tier": city_tier,
            "city_multiplier": float(city_multiplier),
            "severity_multiplier": float(severity_mult),
            "disruption_probability": round(float(disrupt_p), 4),
            "expected_weekly_income": round(float(income_d * 7), 2),
            "payout_l1": round(float(payout_l1), 2),
            "payout_l2": round(float(payout_l2), 2),
            "payout_l3": round(float(payout_l3), 2),
            "max_events_per_week": 2,
            "model": "ridge_premium_v2",
            "timestamp": datetime.utcnow().isoformat(),
            "cached": False,
        }
        PremiumCache.set(worker_id, _cache_tier, result)
        return result

    except Exception as exc:
        logger.error(
            f"Error calculating premium for worker {worker_id}: {exc}", exc_info=True
        )
        return {
            "error": str(exc),
            "base_premium": 79,
            "personalized_premium": 79,
        }


def get_payout_amount(
    plan_tier: str,
    trigger_level: str,
    city_tier: int = 2,
    fraud_release: str = "release_full",
) -> float:
    """
    Compute final payout in ₹ for a given claim context.

    Args:
        plan_tier      : basic | standard | premium
        trigger_level  : L1 | L2 | L3
        city_tier      : 1, 2, or 3
        fraud_release  : release_full | release_partial | hold_48h | block_permanent
    """
    try:
        if fraud_release in ("block_permanent", "hold_48h"):
            return 0.0

        base_payout = PAYOUT_RATES_BASE.get(plan_tier, {}).get(trigger_level, 0)
        city_mult = CITY_TIER_MULTIPLIERS.get(city_tier, 1.0)
        severity_mult = (
            SEVERITY_MULTIPLIERS.get(city_tier, 1.0) if city_tier > 1 else 1.0
        )
        payout = base_payout * city_mult * severity_mult

        if fraud_release == "release_partial":
            payout *= 0.5

        return round(float(payout), 2)

    except Exception as exc:
        logger.error(f"Error computing payout: {exc}")
        return 0.0
