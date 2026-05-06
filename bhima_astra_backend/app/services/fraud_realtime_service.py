"""
Fraud Realtime Service
======================
Runs the full 4-stage fraud ML pipeline on demand for a specific claim
and maintains a rolling Redis live-feed of the last 20 analysis results.
"""

import json
import logging
from datetime import datetime
from typing import Any, Dict, List

from app.utils.redis_client import redis_client
from sqlalchemy.orm import Session

logger = logging.getLogger("bhima.fraud_realtime_service")

# ─── Redis configuration ────────────────────────────────────────────────────
FRAUD_LIVE_KEY = "fraud:live_results"
FRAUD_LIVE_TTL = 86400  # 24 hours – results survive a server restart
MAX_LIVE_RESULTS = 20


# ============================================================================
# CORE: Analyze a single claim through the ML pipeline
# ============================================================================


def analyze_claim(db: Session, claim_id: int) -> Dict[str, Any]:
    """
    Run the complete 4-stage fraud ML pipeline on *claim_id*.

    Stages (delegated to fraud_inference.run_fraud_check):
    1. Deterministic anti-spoofing rules
    2. Behavioral scoring (GPS / motion / interaction)
    3. Ring-fraud graph detection
    4. XGBoost + adaptive-percentile decisioning

    The result is appended to the Redis live feed and returned directly
    so the HTTP response is always populated, even on partial failure.
    """
    try:
        from app.ml.fraud_inference import run_fraud_check

        result = run_fraud_check(db, claim_id)

        # ── Build SHAP-like explanation from stage scores ─────────────────
        shap_data: List[Dict[str, Any]] = []
        stage_scores: Dict[str, Any] = result.get("stage_scores", {})
        for stage_name, score in stage_scores.items():
            try:
                score_f = float(score)
            except (TypeError, ValueError):
                score_f = 0.0
            shap_data.append(
                {
                    "feature_name": stage_name,
                    "shap_value": round(score_f, 4),
                    "contribution": "fraud" if score_f > 0.5 else "clean",
                }
            )

        # ── Also surface stage_breakdown features if present ─────────────
        stage_breakdown: Dict[str, Any] = result.get("stage_breakdown", {})
        for bd_key, bd_val in stage_breakdown.items():
            if bd_key not in stage_scores:
                try:
                    bd_f = float(bd_val)
                    shap_data.append(
                        {
                            "feature_name": bd_key,
                            "shap_value": round(bd_f, 4),
                            "contribution": "fraud" if bd_f > 0.5 else "clean",
                        }
                    )
                except (TypeError, ValueError):
                    pass  # skip non-numeric breakdown fields

        response: Dict[str, Any] = {
            "claim_id": claim_id,
            "fraud_score": round(float(result.get("fraud_score", 0.0)), 4),
            "fraud_flag": bool(result.get("fraud_flag", False)),
            "fraud_reason": result.get("fraud_reason", []),
            "stage_reached": result.get("stage_reached", "unknown"),
            "payout_action": result.get("payout_action", "hold_48h"),
            "shap_explanation": shap_data,
            "stage_breakdown": stage_breakdown,
            "processing_time_ms": round(
                float(result.get("processing_time_ms", 0.0)), 2
            ),
            "analyzed_at": datetime.utcnow().isoformat(),
        }

        # Persist to Redis live feed
        _append_live_result(response)

        return response

    except Exception as exc:
        logger.error(
            "[FRAUD REALTIME] analyze_claim failed for claim_id=%s: %s",
            claim_id,
            exc,
        )
        fallback: Dict[str, Any] = {
            "claim_id": claim_id,
            "fraud_score": 0.0,
            "fraud_flag": False,
            "fraud_reason": ["Analysis failed – check server logs"],
            "stage_reached": "error",
            "payout_action": "hold_48h",
            "shap_explanation": [],
            "stage_breakdown": {},
            "processing_time_ms": 0.0,
            "analyzed_at": datetime.utcnow().isoformat(),
            "error": str(exc),
        }
        # Still append fallback so the live feed reflects the attempt
        _append_live_result(fallback)
        return fallback


# ============================================================================
# REDIS HELPERS
# ============================================================================


def _append_live_result(result: Dict[str, Any]) -> None:
    """
    Prepend *result* to the Redis live-feed list and trim to MAX_LIVE_RESULTS.
    Silently swallows Redis errors so the main response is never blocked.
    """
    try:
        serialised = json.dumps(result, default=str)
        redis_client.lpush(FRAUD_LIVE_KEY, serialised)
        redis_client.ltrim(FRAUD_LIVE_KEY, 0, MAX_LIVE_RESULTS - 1)
        redis_client.expire(FRAUD_LIVE_KEY, FRAUD_LIVE_TTL)
        logger.debug(
            "[FRAUD REALTIME] Appended claim_id=%s to live feed",
            result.get("claim_id"),
        )
    except Exception as exc:
        logger.warning("[FRAUD REALTIME] Redis append failed: %s", exc)


def get_live_fraud_results() -> List[Dict[str, Any]]:
    """
    Return the last ``MAX_LIVE_RESULTS`` fraud analysis results from Redis.

    Each item contains at minimum:
    ``claim_id``, ``fraud_score``, ``fraud_flag``, ``fraud_reason``,
    ``stage_reached``, ``payout_action``, ``analyzed_at``.

    Returns an empty list if Redis is unavailable or the key does not exist.
    """
    try:
        raw_items = redis_client.lrange(FRAUD_LIVE_KEY, 0, MAX_LIVE_RESULTS - 1)
        results: List[Dict[str, Any]] = []
        for raw in raw_items:
            try:
                results.append(json.loads(raw))
            except (json.JSONDecodeError, TypeError) as parse_err:
                logger.warning(
                    "[FRAUD REALTIME] Skipping malformed Redis entry: %s", parse_err
                )
        return results
    except Exception as exc:
        logger.error("[FRAUD REALTIME] get_live_results error: %s", exc)
        return []
