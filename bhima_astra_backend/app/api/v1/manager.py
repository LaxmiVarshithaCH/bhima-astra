from typing import List, Optional

from app.core.deps import get_current_user
from app.db.session import get_db
from app.schemas.manager import (
    CreateFlagRequest,
    FlagResponse,
    ManagerDashboardStats,
    ManagerProfile,
    MessageResponse,
    TriggerEventResponse,
    WorkerInZone,
)
from app.services.manager_service import (
    create_disruption_flag_full,
    create_flag,
    get_manager_dashboard_stats,
    get_manager_flags,
    get_manager_flags_all,
    get_manager_profile,
    get_workers_in_zone,
    get_zone_trigger_events,
)
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

router = APIRouter(prefix="/manager", tags=["Manager"])


# ── Profile & auth-bound endpoints ──────────────────────────────────────────


@router.get("/me/profile")
def manager_profile(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get authenticated manager's profile and assigned zones."""
    manager_id = current_user.manager_id
    if not manager_id:
        raise HTTPException(status_code=403, detail="Manager access only")
    profile = get_manager_profile(db, manager_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Manager not found")
    return profile


@router.get("/me/stats")
def manager_stats(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Dashboard stats for all zones assigned to this manager."""
    manager_id = current_user.manager_id
    if not manager_id:
        raise HTTPException(status_code=403, detail="Manager access only")
    return get_manager_dashboard_stats(db, manager_id)


@router.get("/me/flags")
def manager_flags_me(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """All disruption flags submitted by this manager."""
    manager_id = current_user.manager_id
    if not manager_id:
        raise HTTPException(status_code=403, detail="Manager access only")
    return get_manager_flags_all(db, manager_id)


# ── Zone-scoped endpoints ────────────────────────────────────────────────────


@router.get("/zones/{zone_id}/workers")
def zone_workers(
    zone_id: str,
    status: Optional[str] = Query(None),
    fraud_risk: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """All workers in a zone with policy status. Filterable by status and fraud_risk."""
    return get_workers_in_zone(
        db, zone_id, status_filter=status, risk_filter=fraud_risk
    )


@router.get("/zones/{zone_id}/triggers")
def zone_triggers(
    zone_id: str,
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
):
    """Recent trigger events for a zone."""
    return get_zone_trigger_events(db, zone_id, limit=limit)


# ── Flag endpoints ───────────────────────────────────────────────────────────


@router.post("/flag-disruption")
def flag_disruption(
    request: CreateFlagRequest,
    db: Session = Depends(get_db),
):
    """Submit a social disruption flag with full detail (route, evidence, times)."""
    result = create_disruption_flag_full(
        db,
        manager_id=request.manager_id,
        zone_id=request.zone_id,
        disruption_type=request.disruption_type,
        description=request.description,
        evidence_url=request.evidence_url,
        estimated_start=request.estimated_start,
        estimated_end=request.estimated_end,
        workers_in_zone=request.workers_in_zone,
        estimated_payout=request.estimated_payout,
        affected_worker_ids=request.affected_worker_ids,
    )
    if "error" in result:
        raise HTTPException(status_code=403, detail=result["error"])
    return result


@router.post("/flag", response_model=MessageResponse)
def create_disruption_flag(
    request: CreateFlagRequest,
    db: Session = Depends(get_db),
):
    """Legacy flag endpoint (simple). Use /flag-disruption for full detail."""
    if request.disruption_type not in [
        "strike",
        "protest",
        "curfew",
        "road_blockage",
        "zone_shutdown",
    ]:
        raise HTTPException(status_code=400, detail="Invalid disruption type")
    return create_flag(
        db,
        request.manager_id,
        request.zone_id,
        request.disruption_type,
        request.description,
    )


@router.get("/flags")
def fetch_flags(manager_id: int, db: Session = Depends(get_db)):
    """Get flags by manager_id (legacy, no auth required)."""
    return get_manager_flags(db, manager_id)


# ── FlagDisruption.tsx compatibility endpoints ───────────────────────────────
# These are called by /api/v1/manager/disruptions?zone_id=X and
# /api/v1/manager/delivery-partners?zone_id=X from disruptionApi.ts

# Zone centroid lookup for delivery partner positioning
ZONE_CENTROIDS: dict = {
    "Hebbal": (13.0356, 77.5970),
    "Sanganer": (26.8401, 75.8060),
    "Mehdipatnam": (17.3887, 78.4420),
    "Dadar": (19.0219, 72.8438),
    "Koramangala": (12.9352, 77.6245),
    "Bellandur": (12.9259, 77.6762),
    "Andheri-W": (19.1360, 72.8296),
    "Bandra-E": (19.0596, 72.8547),
    "Goregaon": (19.1663, 72.8526),
    "Vikhroli": (19.0968, 72.9216),
    "Worli": (19.0176, 72.8162),
    "Malviya Nagar": (26.8505, 75.8028),
    "Vaishali Nagar": (26.9041, 75.7378),
    "Raja Park": (26.9124, 75.8110),
    "Mansarovar": (26.8484, 75.7511),
    "Rajajinagar": (12.9908, 77.5560),
    "Yelahanka": (13.1007, 77.5963),
    "Kukatpally": (17.4850, 78.4087),
    "Hitech City": (17.4435, 78.3772),
    "Gachibowli": (17.4401, 78.3489),
    "Dilsukhnagar": (17.3688, 78.5247),
    "Wakad": (18.5975, 73.7613),
    "Hadapsar": (18.5089, 73.9259),
    "Kothrud": (18.5074, 73.8077),
    "Baner": (18.5590, 73.7868),
    "Anna Nagar": (13.0850, 80.2101),
    "Mylapore": (13.0339, 80.2706),
    "Perambur": (13.1167, 80.2472),
    "Chrompet": (12.9516, 80.1462),
    "Rohini-Sec3": (28.7041, 77.1025),
    "CP": (28.6315, 77.2167),
    "Dwarka-Sec10": (28.5832, 77.0515),
}


@router.get("/flags/{flag_id}/affected-workers")
def affected_workers_for_flag(
    flag_id: int,
    db: Session = Depends(get_db),
):
    """Return only the workers affected by a specific flag (stored at flag-submission time)."""
    from sqlalchemy import text as sq_text

    row = db.execute(
        sq_text("""
            SELECT affected_worker_ids, zone_id, workers_in_zone
            FROM manager_disruption_flags
            WHERE flag_id = :fid
        """),
        {"fid": flag_id},
    ).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Flag not found")

    worker_ids = row.affected_worker_ids  # int[] or None
    if not worker_ids:
        # Legacy flag — no IDs stored; return empty so UI shows the "no data" message
        return []
    zone_workers = get_workers_in_zone(db, row.zone_id)
    filtered = [w for w in zone_workers if w.get("worker_id") in worker_ids]
    return filtered


@router.get("/disruptions")
def manager_disruptions(zone_id: Optional[str] = Query(None), db: Session = Depends(get_db)):
    """Return disruption flags for FlagDisruption.tsx compatibility (zone_id filter optional)."""
    from sqlalchemy import text as sq_text
    query = """
        SELECT flag_id, manager_id, zone_id, disruption_type, description,
               evidence_url, estimated_start, estimated_end,
               flag_status, created_at
        FROM manager_disruption_flags
        WHERE 1=1
    """
    params: dict = {}
    if zone_id:
        query += " AND zone_id = :zone_id"
        params["zone_id"] = zone_id
    query += " ORDER BY created_at DESC LIMIT 50"

    rows = db.execute(sq_text(query), params).fetchall()

    result = []
    for r in rows:
        result.append({
            "id": str(r.flag_id),
            "zone_id": r.zone_id,
            "disruption_type": r.disruption_type,
            "description": r.description or "",
            "evidence_url": r.evidence_url or "",
            "estimated_start": str(r.estimated_start) if r.estimated_start else "",
            "estimated_end": str(r.estimated_end) if r.estimated_end else "",
            "status": r.flag_status or "pending",
            "affected_routes": [],
            "created_at": str(r.created_at) if r.created_at else "",
            "coordinates": [],
            "workers_with_alternatives": [],
            "workers_without_alternatives": [],
            "affected_workers_count": 0,
            "affected_workers_details": [],
            "payout_flag_requests": [],
        })
    return result


@router.get("/delivery-partners")
def delivery_partners(zone_id: Optional[str] = Query(None), db: Session = Depends(get_db)):
    """Return workers in zone as delivery partners spread up to 5 km from the dark store."""
    import math

    target_zone = zone_id or ""
    workers = get_workers_in_zone(db, target_zone) if target_zone else []

    # Use dark store coords from DB if available, else fall back to centroid
    center_lat, center_lng = ZONE_CENTROIDS.get(target_zone, (12.9716, 77.5946))

    # Try to get the actual dark store coords from the manager record
    from sqlalchemy import text as sq_text
    mgr_row = db.execute(
        sq_text("SELECT dark_store_lat, dark_store_lng FROM managers WHERE :zone = ANY(assigned_zones) LIMIT 1"),
        {"zone": target_zone},
    ).fetchone()
    if mgr_row and mgr_row.dark_store_lat:
        center_lat = float(mgr_row.dark_store_lat)
        center_lng = float(mgr_row.dark_store_lng)

    # Degrees per km (approx for India)
    LAT_PER_KM = 0.0090
    LNG_PER_KM = 0.0113

    result = []
    for i, w in enumerate(workers):
        # Use prime angle step (97.3°) so no two workers overlap
        # and vary radius from 0.5 km up to 5 km using worker_id as seed
        angle_deg = (i * 97.3) % 360

        # Deterministic radius: 0.5–5 km spread evenly across workers
        if len(workers) > 1:
            # spread evenly between 0.5 and 5.0 km
            dist_km = 0.5 + (i / max(len(workers) - 1, 1)) * 4.5
        else:
            dist_km = 2.5

        # Vary slightly per worker_id so refreshing is stable
        jitter = (w["worker_id"] % 7) * 0.08  # 0 – 0.48 km jitter
        dist_km = min(5.0, dist_km + jitter)

        lat = center_lat + dist_km * math.cos(math.radians(angle_deg)) * LAT_PER_KM
        lng = center_lng + dist_km * math.sin(math.radians(angle_deg)) * LNG_PER_KM

        result.append({
            "id": w["worker_id"],
            "name": w["worker_name"] or "Unknown",
            "worker_id": str(w["worker_id"]),
            "lat": round(lat, 6),
            "lng": round(lng, 6),
            "status": "online" if w.get("kyc_verified") else "offline",
            "current_route": {
                "id": f"route-{w['worker_id']}",
                "name": f"Dark Store → {target_zone}",
                "coordinates": [
                    [center_lat, center_lng],
                    [round(lat, 6), round(lng, 6)],
                ],
                "blocked": False,
            },
        })
    return result
