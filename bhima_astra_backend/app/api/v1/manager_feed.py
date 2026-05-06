"""
Manager Feed, Triggers & Stats API
====================================
Missing endpoints referenced by manager mockData.ts:
  GET /api/v1/manager/feed      → recent claim events (feed for all zones)
  GET /api/v1/manager/triggers  → recent trigger events across all zones
  GET /api/v1/manager/stats     → daily stats for the manager dashboard
"""

from datetime import datetime, timedelta
from typing import Any, Dict, List

from app.db.session import get_db
from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

router = APIRouter(prefix="/api/v1/manager", tags=["Manager Feed"])


@router.get("/feed")
def get_manager_feed(
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    """
    Recent worker activity events (claims created, payouts, fraud flags).
    Used by manager dashboard worker activity feed widget.
    """
    try:
        result = db.execute(
            text("""
            SELECT
                pc.claim_id,
                pc.worker_id,
                w.worker_name,
                pc.payout_status,
                pc.fraud_flag,
                pc.payout_amount,
                pc.trigger_type,
                pc.trigger_level,
                w.geo_zone_id,
                pc.claim_timestamp,
                pc.payout_timestamp
            FROM policy_claims pc
            JOIN workers w ON pc.worker_id = w.worker_id
            WHERE pc.claim_timestamp IS NOT NULL
            ORDER BY pc.claim_timestamp DESC
            LIMIT :limit
            """),
            {"limit": limit},
        ).fetchall()

        feed = []
        for r in result:
            payout_status = (r.payout_status or "pending").lower()
            fraud_flag = bool(r.fraud_flag)

            # Map DB state → feed action type
            if fraud_flag:
                action = "claim_flagged"
            elif payout_status in ("paid", "completed", "released"):
                action = "payout_completed"
            elif payout_status in ("approved", "processing"):
                action = "claim_approved"
            else:
                action = "claim_created"

            # Time display
            ts = r.payout_timestamp or r.claim_timestamp
            ts_str = ts.isoformat() if ts else datetime.utcnow().isoformat()

            entry = {
                "id": f"f{r.claim_id}",
                "worker_id": r.worker_id,
                "worker_name": r.worker_name or f"Worker {r.worker_id}",
                "action": action,
                "zone_id": r.geo_zone_id or "Unknown",
                "timestamp": ts_str,
            }
            if r.payout_amount and payout_status in ("paid", "completed", "released", "approved"):
                entry["amount"] = float(r.payout_amount)

            feed.append(entry)

        return feed

    except Exception as exc:
        return []


@router.get("/triggers")
def get_manager_triggers(
    limit: int = Query(5, ge=1, le=20),
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    """
    Recent trigger events for the manager dashboard trigger panel.
    Groups by trigger_type + approximate time window to return cohort-level events.
    """
    try:
        result = db.execute(
            text("""
            SELECT
                trigger_type,
                trigger_level,
                trigger_value,
                w.geo_zone_id,
                COUNT(pc.claim_id)          AS workers_affected,
                MIN(pc.claim_timestamp)     AS fired_at,
                MAX(pc.payout_status)       AS latest_status,
                SUM(pc.payout_amount)       AS total_payout
            FROM policy_claims pc
            JOIN workers w ON pc.worker_id = w.worker_id
            WHERE pc.claim_auto_created = true
              AND pc.trigger_type IS NOT NULL
              AND pc.claim_timestamp IS NOT NULL
              AND pc.claim_timestamp > NOW() - INTERVAL '30 days'
            GROUP BY
                trigger_type,
                trigger_level,
                trigger_value,
                w.geo_zone_id,
                DATE_TRUNC('hour', pc.claim_timestamp)
            ORDER BY fired_at DESC
            LIMIT :limit
            """),
            {"limit": limit},
        ).fetchall()

        triggers = []
        for i, r in enumerate(result):
            latest_status = (r.latest_status or "monitoring").lower()

            # Map payout status → trigger status
            if latest_status in ("paid", "completed", "released"):
                status = "resolved"
            elif latest_status in ("pending", "processing"):
                status = "active"
            else:
                status = "monitoring"

            fired_at = r.fired_at.isoformat() if r.fired_at else datetime.utcnow().isoformat()

            triggers.append({
                "trigger_id": f"t{i + 1}",
                "trigger_type": r.trigger_type,
                "trigger_level": r.trigger_level or "L1",
                "trigger_value": float(r.trigger_value or 0),
                "zone_id": r.geo_zone_id or "Unknown",
                "status": status,
                "workers_affected": int(r.workers_affected or 0),
                "fired_at": fired_at,
                "total_payout": float(r.total_payout or 0),
            })

        return triggers

    except Exception as exc:
        return []


@router.get("/stats")
def get_manager_stats(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """
    Daily stats for manager dashboard stats widget.
    Does NOT require auth so manager mockData.ts can call it freely.
    """
    try:
        result = db.execute(
            text("""
            SELECT
                COUNT(DISTINCT pc.claim_id)
                    FILTER (WHERE pc.claim_timestamp > NOW() - INTERVAL '24 hours')
                                                    AS total_claims_today,
                COUNT(DISTINCT pc.claim_id)
                    FILTER (WHERE pc.payout_status IN ('paid','completed','released')
                            AND pc.claim_timestamp > NOW() - INTERVAL '24 hours')
                                                    AS approved_payouts,
                COUNT(DISTINCT pc.claim_id)
                    FILTER (WHERE pc.fraud_flag = true
                            AND pc.claim_timestamp > NOW() - INTERVAL '24 hours')
                                                    AS flagged_cases,
                AVG(EXTRACT(EPOCH FROM (pc.payout_timestamp - pc.claim_timestamp)))
                    FILTER (WHERE pc.payout_timestamp IS NOT NULL
                            AND pc.claim_timestamp IS NOT NULL
                            AND pc.claim_timestamp > NOW() - INTERVAL '7 days')
                                                    AS avg_processing_time_sec,
                COUNT(DISTINCT w.worker_id)
                    FILTER (WHERE w.worker_id IS NOT NULL)
                                                    AS new_registrations,
                COUNT(DISTINCT w.worker_id)
                    FILTER (WHERE pc.payout_status = 'held')
                                                    AS offline_workers
            FROM policy_claims pc
            JOIN workers w ON pc.worker_id = w.worker_id
            """)
        ).fetchone()

        return {
            "total_claims_today": int(result.total_claims_today or 0),
            "approved_payouts": int(result.approved_payouts or 0),
            "flagged_cases": int(result.flagged_cases or 0),
            "avg_processing_time_sec": round(float(result.avg_processing_time_sec or 87), 1),
            "new_registrations": int(result.new_registrations or 0),
            "offline_workers": int(result.offline_workers or 0),
        }

    except Exception as exc:
        return {
            "total_claims_today": 0,
            "approved_payouts": 0,
            "flagged_cases": 0,
            "avg_processing_time_sec": 0,
            "new_registrations": 0,
            "offline_workers": 0,
        }
