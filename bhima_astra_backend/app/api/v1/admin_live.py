from datetime import datetime
from typing import List

from app.db.session import get_db
from app.schemas.admin_live import AuditEvent, FraudAlert, TriggerEvent
from app.services.admin_live_service import (
    get_fraud_alerts,
    get_live_triggers,
    get_recent_activity,
)
from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

router = APIRouter(prefix="/api/v1/admin/live", tags=["Admin Live"])


# 🔴 TRIGGERS
@router.get("/triggers", response_model=List[TriggerEvent])
def fetch_triggers(db: Session = Depends(get_db)):
    return get_live_triggers(db)


# 🆕 LATEST REAL TRIGGER from policy_claims
@router.get("/triggers/latest")
def fetch_latest_trigger(db: Session = Depends(get_db)):
    """Returns the most recent auto-created claim as a trigger event."""
    try:
        result = db.execute(
            text("""
            SELECT
                pc.claim_id,
                pc.trigger_type,
                pc.trigger_level,
                pc.trigger_value,
                pc.claim_timestamp,
                w.geo_zone_id,
                COUNT(*) OVER (PARTITION BY pc.trigger_type, DATE_TRUNC('hour', pc.claim_timestamp)) as workers_affected
            FROM policy_claims pc
            LEFT JOIN workers w ON pc.worker_id = w.worker_id
            WHERE pc.claim_auto_created = true
              AND pc.trigger_type IS NOT NULL
              AND pc.claim_timestamp IS NOT NULL
            ORDER BY pc.claim_timestamp DESC
            LIMIT 1
        """)
        ).fetchone()

        if result:
            return {
                "id": f"TRG-{result.claim_id}",
                "timestamp": result.claim_timestamp.isoformat()
                if result.claim_timestamp
                else datetime.utcnow().isoformat(),
                "zone": result.geo_zone_id or "Unknown",
                "trigger_type": result.trigger_type or "disruption",
                "severity": result.trigger_level or "L1",
                "workers_affected": int(result.workers_affected or 0),
            }
        else:
            return {
                "id": None,
                "status": "no_triggers",
                "message": "No auto-created triggers found in database",
            }
    except Exception as e:
        return {
            "id": None,
            "status": "error",
            "error": str(e),
        }


# 🚨 FRAUD ALERTS
@router.get("/fraud-alerts", response_model=List[FraudAlert])
def fetch_fraud_alerts(db: Session = Depends(get_db)):
    return get_fraud_alerts(db)


# 📜 ACTIVITY FEED
@router.get("/recent-activity", response_model=List[AuditEvent])
def fetch_activity(db: Session = Depends(get_db)):
    return get_recent_activity(db)
