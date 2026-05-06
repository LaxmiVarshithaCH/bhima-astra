"""
Fraud Realtime Router
=====================
Adds endpoints to the existing /api/v1/admin/fraud prefix:

  POST /api/v1/admin/fraud/analyze/{claim_id}
       Run the full 4-stage fraud ML pipeline on demand for a specific claim.
       Returns fraud score, flag, reason, stage breakdown, and SHAP-like values.

  GET  /api/v1/admin/fraud/live
       Return the last 20 fraud analysis results stored in the Redis live feed.

  GET  /api/v1/admin/fraud/pending
       Return claims pending fraud review (fraud_flag=True, held/blocked status).
"""

import logging
from typing import List

from app.db.session import get_db
from app.schemas.fraud_realtime import FraudAnalyzeResponse, FraudLiveItem
from app.services.fraud_realtime_service import analyze_claim, get_live_fraud_results
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

logger = logging.getLogger("bhima.fraud_realtime_router")

router = APIRouter(prefix="/api/v1/admin/fraud", tags=["Admin Fraud Realtime"])


# 🔍 ANALYZE A SPECIFIC CLAIM — full 4-stage ML pipeline on demand
@router.post("/analyze/{claim_id}", response_model=FraudAnalyzeResponse)
def post_analyze_claim(claim_id: int, db: Session = Depends(get_db)):
    """
    Run the complete 4-stage fraud ML pipeline on a specific claim.

    **Pipeline stages** (handled by `fraud_inference.run_fraud_check`):
    1. Deterministic anti-spoofing rules
    2. Behavioral scoring (GPS / motion / interaction / location jump)
    3. Ring-fraud graph detection (Louvain community clustering)
    4. XGBoost tabular model + adaptive-percentile decisioning

    **Returns:**
    - `fraud_score`       – float 0–1 composite fraud probability
    - `fraud_flag`        – bool decision
    - `fraud_reason`      – list of human-readable reason strings
    - `stage_reached`     – which stage made the final decision
    - `payout_action`     – e.g. "release_full", "hold_48h", "block_permanent"
    - `shap_explanation`  – per-stage SHAP-like feature contributions
    - `stage_breakdown`   – raw score breakdown per stage
    - `processing_time_ms`– end-to-end latency of the ML cascade

    Never crashes – returns a safe fallback with `error` key if analysis fails.
    """
    return analyze_claim(db, claim_id)


# 📺 LIVE FRAUD FEED — last 20 realtime analysis results from Redis
@router.get("/live", response_model=List[FraudLiveItem])
def get_fraud_live():
    """
    Return the last 20 on-demand fraud analysis results from the Redis live feed.

    Results are stored each time `POST /fraud/analyze/{claim_id}` is called.
    The feed is ordered newest-first (most recent analysis at index 0).

    Returns an empty list if no analyses have been run yet or Redis is unavailable.
    """
    return get_live_fraud_results()


# 🚨 PENDING FRAUD QUEUE — claims flagged for fraud review
@router.get("/pending")
def get_pending_fraud_checks(db: Session = Depends(get_db)):
    """Returns claims pending fraud review - fraud_flag=True with held/blocked status."""
    try:
        from sqlalchemy import text

        result = db.execute(
            text("""
            SELECT
                pc.claim_id,
                pc.worker_id,
                w.worker_name,
                w.geo_zone_id,
                pc.fraud_score,
                pc.fraud_flag,
                pc.fraud_reason,
                pc.trigger_type,
                pc.trigger_level,
                pc.payout_status,
                pc.claim_timestamp,
                pc.gps_lat,
                pc.gps_lng,
                pc.gps_tower_delta,
                pc.accelerometer_variance,
                pc.app_interaction_count,
                pc.claim_response_time_sec
            FROM policy_claims pc
            LEFT JOIN workers w ON pc.worker_id = w.worker_id
            WHERE (
                -- Existing fraud-flagged blocked/held claims
                (pc.fraud_flag = true AND pc.payout_status IN ('blocked', 'held', 'rejected', 'approved'))
                OR
                -- Recent simulation workers (last 2 hours) that are pending/processing
                (
                    pc.claim_auto_created = true
                    AND pc.payout_status IN ('pending', 'processing')
                    AND pc.claim_timestamp > NOW() - INTERVAL '2 hours'
                )
            )
            ORDER BY pc.fraud_score DESC NULLS LAST, pc.claim_timestamp DESC
            LIMIT 20
        """)
        ).fetchall()

        items = []
        for r in result:
            items.append(
                {
                    "claim_id": r.claim_id,
                    "worker_id": r.worker_id,
                    "worker_name": r.worker_name or f"Worker {r.worker_id}",
                    "zone": r.geo_zone_id or "Unknown",
                    "fraud_score": float(r.fraud_score or 0),
                    "fraud_flag": bool(r.fraud_flag),
                    "fraud_reason": r.fraud_reason,
                    "trigger_type": r.trigger_type or "unknown",
                    "trigger_level": r.trigger_level or "L1",
                    "payout_status": r.payout_status,
                    "claim_timestamp": r.claim_timestamp.isoformat()
                    if r.claim_timestamp
                    else None,
                    "location": {
                        "gps_lat": float(r.gps_lat or 0),
                        "gps_lng": float(r.gps_lng or 0),
                        "gps_tower_delta": float(r.gps_tower_delta or 0),
                    },
                    "sensors": {
                        "accelerometer_variance": float(r.accelerometer_variance or 0),
                        "app_interaction_count": int(r.app_interaction_count or 0),
                        "response_time_sec": float(r.claim_response_time_sec or 0),
                    },
                }
            )

        return {"total": len(items), "items": items}

    except Exception as e:
        logger.error(f"[FRAUD PENDING] Query error: {e}")
        return {"total": 0, "items": [], "error": str(e)}
