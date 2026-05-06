from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Any, Dict, List, Optional

from app.db.session import get_db
from app.services.zone_service import (
    compute_zone_live_data,
    get_zone_live_cached,
    get_zone_forecast,
    get_zone_history,
    get_zone_dashboard,
)

# Use /api/v1/zones so admin frontend can reach GET /api/v1/zones
router = APIRouter(prefix="/api/v1/zones", tags=["Zones"])


# ─── GET /api/v1/zones  (list all zones) ────────────────────────────────────
@router.get("")
def list_zones(
    status: Optional[str] = Query(None),
    risk_level: Optional[str] = Query(None),
    city: Optional[str] = Query(None),
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    """Return all distinct zones from DB with worker count, trigger count and risk level."""
    try:
        rows = db.execute(
            text("""
                SELECT
                    w.geo_zone_id                                   AS zone_id,
                    w.city                                          AS city,
                    COUNT(DISTINCT w.worker_id)                     AS worker_count,
                    COUNT(DISTINCT w.worker_id) FILTER (
                        WHERE w.kyc_verified = true
                    )                                               AS active_workers,
                    COUNT(DISTINCT pc.claim_id) FILTER (
                        WHERE pc.claim_timestamp > NOW() - INTERVAL '30 days'
                    )                                               AS triggers_today,
                    COUNT(DISTINCT pc.claim_id)                     AS total_claims,
                    AVG(w.fraud_risk_score)                         AS avg_risk,
                    MAX(w.fraud_risk_score)                         AS max_risk
                FROM workers w
                LEFT JOIN policy_claims pc ON pc.worker_id = w.worker_id
                WHERE w.geo_zone_id IS NOT NULL
                GROUP BY w.geo_zone_id, w.city
                ORDER BY avg_risk DESC NULLS LAST
            """)
        ).fetchall()

        zones = []
        for r in rows:
            avg_risk = float(r.avg_risk or 0.0)
            triggers = int(r.triggers_today or 0)
            total_claims = int(r.total_claims or 0)
            active_workers = int(r.active_workers or 0)

            if avg_risk > 0.6 or triggers > 10:
                risk_level_val = "HIGH"
            elif avg_risk > 0.35 or triggers > 4:
                risk_level_val = "MEDIUM"
            else:
                risk_level_val = "LOW"

            zone = {
                "zone_id": r.zone_id,
                "name": r.zone_id,
                "city": r.city or r.zone_id,
                "worker_count": int(r.worker_count or 0),
                "active_workers": active_workers,
                "triggers_today": triggers,
                "total_claims": total_claims,
                "risk_level": risk_level_val,
                "avg_risk_score": round(avg_risk, 4),
                # Alias fields expected by zonesApi.ts
                "recent_trigger_count": triggers,
                "avg_payout_amount": 500,
                "status": "active",
            }

            # Apply optional filters
            if status and zone["status"].lower() != status.lower():
                continue
            if risk_level and zone["risk_level"].lower() != risk_level.lower():
                continue
            if city and zone["city"].lower() != city.lower():
                continue

            zones.append(zone)

        return zones

    except Exception as e:
        import logging
        logging.getLogger("bhima.zones").error(f"[ZONES LIST] Error: {e}")
        return []


# ─── GET /api/v1/zones/stats ────────────────────────────────────────────────
@router.get("/stats")
def get_zones_stats(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Return aggregate stats across all zones."""
    try:
        row = db.execute(
            text("""
                SELECT
                    COUNT(DISTINCT w.geo_zone_id) AS total_zones,
                    COUNT(DISTINCT w.worker_id)   AS total_workers,
                    COUNT(DISTINCT pc.claim_id) FILTER (
                        WHERE pc.claim_timestamp > NOW() - INTERVAL '24 hours'
                    )                             AS triggers_today,
                    AVG(w.fraud_risk_score)       AS avg_risk
                FROM workers w
                LEFT JOIN policy_claims pc ON pc.worker_id = w.worker_id
            """)
        ).fetchone()

        return {
            "total_zones": int(row.total_zones or 0),
            "total_workers": int(row.total_workers or 0),
            "triggers_today": int(row.triggers_today or 0),
            "avg_risk_score": round(float(row.avg_risk or 0.0), 4),
        }
    except Exception as e:
        import logging
        logging.getLogger("bhima.zones").error(f"[ZONES STATS] Error: {e}")
        return {"total_zones": 0, "total_workers": 0, "triggers_today": 0, "avg_risk_score": 0.0}


# ─── GET /api/v1/zones/{zone_id}/live ───────────────────────────────────────
@router.get("/{zone_id}/live")
def get_zone_live(zone_id: str, db: Session = Depends(get_db)):
    return get_zone_live_cached(db, zone_id)


# ─── GET /api/v1/zones/forecast ─────────────────────────────────────────────
@router.get("/forecast")
def zone_forecast(zone_id: str, db: Session = Depends(get_db)):
    return get_zone_forecast(db, zone_id)


# ─── GET /api/v1/zones/history ──────────────────────────────────────────────
@router.get("/history")
def zone_history(zone_id: str, days: int = 7, db: Session = Depends(get_db)):
    return get_zone_history(db, zone_id, days)


# ─── GET /api/v1/zones/dashboard ────────────────────────────────────────────
@router.get("/dashboard")
def zone_dashboard(zone_id: str, db: Session = Depends(get_db)):
    return get_zone_dashboard(db, zone_id)