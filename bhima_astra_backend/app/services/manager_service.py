import asyncio
import logging
from datetime import datetime
from typing import Optional

from app.db.models.manager import Manager
from app.db.models.worker import Worker
from app.utils.cache_manager import ManagerCache
from app.websocket.connection_manager import manager
from sqlalchemy import text

logger = logging.getLogger("bhima.services.manager_service")


ALLOWED_TYPES = ["strike", "protest", "curfew"]


def create_flag(db, manager_id, zone_id, disruption_type, description):
    disruption_type = disruption_type.lower()
    if disruption_type not in ALLOWED_TYPES:
        return {"error": "Invalid disruption type"}

    # 🔥 Check manager owns this zone
    manager = db.execute(
        text("""
        SELECT assigned_zones
        FROM managers
        WHERE manager_id = :manager_id
    """),
        {"manager_id": manager_id},
    ).fetchone()

    if not manager or zone_id not in manager.assigned_zones:
        return {"error": "Unauthorized zone access"}

    db.execute(
        text("""
        INSERT INTO manager_disruption_flags (
            manager_id,
            zone_id,
            disruption_type,
            description,
            estimated_start,
            estimated_end,
            flag_status,
            payout_enabled,
            created_at
        )
        VALUES (
            :manager_id,
            :zone_id,
            :disruption_type,
            :description,
            NOW(),
            NOW() + INTERVAL '6 hours',
            'pending',
            false,
            NOW()
        )
    """),
        {
            "manager_id": manager_id,
            "zone_id": zone_id,
            "disruption_type": disruption_type,
            "description": description,
        },
    )

    db.commit()

    # 🔥 INVALIDATE CACHE WHEN NEW FLAG IS CREATED
    ManagerCache.set_zone_flags(manager_id, None)  # Invalidate
    logger.info(
        f"[CACHE] Invalidated manager flags cache for manager {manager_id} (new flag created)"
    )

    from app.utils.ws_helper import send_ws_event

    send_ws_event(
        {"type": "NEW_FLAG", "zone_id": zone_id, "disruption": disruption_type}
    )
    return {"status": "flag created (pending admin verification)"}


VALID_TYPES = {"strike", "protest", "curfew", "road_blockage", "zone_shutdown", "flood", "extreme_weather"}


def get_manager_flags(db, manager_id):
    # 🔥 CHECK CACHE FIRST (1 hour TTL for manager flags)
    cached_flags = ManagerCache.get_zone_flags(manager_id)
    if cached_flags:
        cached_flags["cached"] = True
        logger.info(f"[CACHE HIT] Manager flags cache hit for manager {manager_id}")
        return cached_flags

    result = db.execute(
        text("""
        SELECT *
        FROM manager_disruption_flags
        WHERE manager_id = :manager_id
        ORDER BY created_at DESC
    """),
        {"manager_id": manager_id},
    ).fetchall()

    clean_data = []

    for row in result:
        dtype = row.disruption_type.lower()

        if dtype not in VALID_TYPES:
            continue  # 🚀 skip invalid rows

        clean_data.append(
            {
                "flag_id": row.flag_id,
                "manager_id": row.manager_id,
                "zone_id": row.zone_id,
                "disruption_type": dtype,
                "description": row.description,
                "flag_status": row.flag_status,
                "payout_enabled": row.payout_enabled,
                "created_at": row.created_at,
            }
        )

    result_dict = {"manager_id": manager_id, "flags": clean_data, "cached": False}

    # 🔥 CACHE THE MANAGER FLAGS
    ManagerCache.set_zone_flags(manager_id, result_dict)

    return clean_data


# ── New service functions ────────────────────────────────────────────────────


def get_manager_profile(db, manager_id: int):
    """Get manager profile including assigned zones."""
    mgr = db.query(Manager).filter(Manager.manager_id == manager_id).first()
    if not mgr:
        return None
    # Safely read new columns (added via migration; may not exist on older DBs)
    dark_store_lat = getattr(mgr, "dark_store_lat", None)
    dark_store_lng = getattr(mgr, "dark_store_lng", None)
    dark_store_address = getattr(mgr, "dark_store_address", None)
    return {
        "manager_id": mgr.manager_id,
        "manager_name": mgr.manager_name,
        "email": mgr.email,
        "assigned_zones": mgr.assigned_zones or [],
        "dark_store_lat": float(dark_store_lat) if dark_store_lat else None,
        "dark_store_lng": float(dark_store_lng) if dark_store_lng else None,
        "dark_store_address": dark_store_address,
    }


def get_workers_in_zone(
    db,
    zone_id: str,
    status_filter: Optional[str] = None,
    risk_filter: Optional[str] = None,
):
    """Get all workers in a zone with their active policy status and today's earnings."""
    from datetime import date as dt_date
    today = dt_date.today()

    workers = db.query(Worker).filter(Worker.geo_zone_id == zone_id).all()

    result = []
    for w in workers:
        # Get active policy
        policy = db.execute(
            text("""
            SELECT plan_tier, policy_status
            FROM policy_claims
            WHERE worker_id = :wid AND policy_status = 'active'
            ORDER BY activation_date DESC
            LIMIT 1
        """),
            {"wid": w.worker_id},
        ).fetchone()

        # Get latest available earnings from daily_operations
        ops = db.execute(
            text("""
            SELECT
                COALESCE(SUM(actual_income), 0) AS income_today,
                COALESCE(SUM(orders_per_day), 0) AS orders_today
            FROM daily_operations
            WHERE worker_id = :wid
              AND date = (
                SELECT MAX(date) FROM daily_operations WHERE worker_id = :wid
              )
        """),
            {"wid": w.worker_id},
        ).fetchone()

        fraud_score = float(w.fraud_risk_score) if w.fraud_risk_score else 0.0

        # Apply risk filter
        if risk_filter and risk_filter != "all":
            if risk_filter == "low" and fraud_score >= 0.3:
                continue
            elif risk_filter == "medium" and not (0.3 <= fraud_score < 0.7):
                continue
            elif risk_filter == "high" and fraud_score < 0.7:
                continue

        result.append(
            {
                "worker_id": w.worker_id,
                "worker_name": w.worker_name,
                "platform": w.platform,
                "vehicle_type": w.vehicle_type,
                "geo_zone_id": w.geo_zone_id,
                "fraud_risk_score": fraud_score,
                "kyc_verified": w.kyc_verified,
                "payment_verified_status": w.payment_verified_status,
                "upi_id": w.upi_id,
                "policy_status": policy.policy_status if policy else "none",
                "plan_tier": policy.plan_tier if policy else None,
                "income_today": float(ops.income_today) if ops else 0.0,
                "orders_today": int(ops.orders_today) if ops else 0,
            }
        )

    return result


def get_manager_dashboard_stats(db, manager_id: int):
    """Compute dashboard stats for all zones assigned to this manager."""
    mgr = db.query(Manager).filter(Manager.manager_id == manager_id).first()
    if not mgr:
        return {}

    zones = mgr.assigned_zones or []
    if not zones:
        return {
            "new_registrations": 0,
            "payouts_processed": 0.0,
            "flags_raised": 0,
            "offline_workers_paid": 0,
            "fraud_holds": 0,
            "total_active_workers": 0,
            "total_active_policies": 0,
        }

    try:
        from datetime import timedelta

        today = datetime.utcnow().date()
        week_start = today - timedelta(days=7)

        # All workers in manager zones
        workers = db.query(Worker).filter(Worker.geo_zone_id.in_(zones)).all()
        worker_ids = [w.worker_id for w in workers]
        total_workers = len(workers)
        kyc_workers = len([w for w in workers if w.kyc_verified])

        if not worker_ids:
            return {
                "new_registrations": total_workers,
                "payouts_processed": 0.0,
                "flags_raised": 0,
                "offline_workers_paid": 0,
                "fraud_holds": 0,
                "total_active_workers": kyc_workers,
                "total_active_policies": 0,
            }

        # Single aggregated query on policy_claims
        claim_stats = db.execute(
            text("""
            SELECT
                COALESCE(SUM(payout_amount), 0)                                      AS total_payout,
                COUNT(*) FILTER (WHERE fraud_flag = TRUE)                            AS fraud_holds,
                COUNT(*) FILTER (WHERE payout_status = 'paid')                      AS paid_count,
                COUNT(*) FILTER (WHERE claim_timestamp >= :week_start
                                 AND payout_status = 'paid')                        AS week_paid
            FROM policy_claims
            WHERE worker_id = ANY(:wids)
        """),
            {"wids": worker_ids, "week_start": week_start},
        ).fetchone()

        # Active policies count
        active_policies = db.execute(
            text("""
            SELECT COUNT(DISTINCT worker_id)
            FROM policy_claims
            WHERE worker_id = ANY(:wids)
              AND policy_status = 'active'
        """),
            {"wids": worker_ids},
        ).fetchone()

        # Flags raised by this manager this week
        flags_count = db.execute(
            text("""
            SELECT COUNT(*) FROM manager_disruption_flags
            WHERE manager_id = :mid
              AND created_at >= :week_start
        """),
            {"mid": manager_id, "week_start": week_start},
        ).fetchone()

        return {
            "new_registrations": total_workers,
            "payouts_processed": float(claim_stats.total_payout) if claim_stats else 0.0,
            "flags_raised": int(flags_count[0]) if flags_count else 0,
            "offline_workers_paid": int(claim_stats.week_paid) if claim_stats else 0,
            "fraud_holds": int(claim_stats.fraud_holds) if claim_stats else 0,
            "total_active_workers": kyc_workers,
            "total_active_policies": int(active_policies[0]) if active_policies else 0,
        }
    except Exception as e:
        logger.error(f"Error computing manager stats for manager {manager_id}: {e}", exc_info=True)
        return {
            "new_registrations": 0,
            "payouts_processed": 0.0,
            "flags_raised": 0,
            "offline_workers_paid": 0,
            "fraud_holds": 0,
            "total_active_workers": 0,
            "total_active_policies": 0,
        }



def get_zone_trigger_events(db, zone_id: str, limit: int = 10):
    """Get recent trigger events (claims) for a zone."""
    try:
        rows = db.execute(
            text("""
            SELECT
                pc.claim_id,
                w.geo_zone_id,
                pc.trigger_type,
                pc.trigger_level,
                pc.trigger_value,
                pc.payout_amount,
                pc.payout_status,
                pc.fraud_flag,
                pc.claim_timestamp,
                COUNT(*) OVER (
                    PARTITION BY pc.trigger_type, DATE(pc.claim_timestamp)
                ) as workers_affected
            FROM policy_claims pc
            JOIN workers w ON w.worker_id = pc.worker_id
            WHERE w.geo_zone_id = :zone_id
              AND pc.trigger_type IS NOT NULL
              AND pc.trigger_type != 'unknown'
            ORDER BY pc.claim_timestamp DESC
            LIMIT :limit
        """),
            {"zone_id": zone_id, "limit": limit},
        ).fetchall()

        # Aggregate by trigger event (group by trigger_type + date window)
        seen = {}
        result = []
        for row in rows:
            key = (
                f"{row.trigger_type}_"
                f"{row.claim_timestamp.date() if row.claim_timestamp else 'unknown'}"
            )
            if key not in seen:
                seen[key] = {
                    "claim_id": row.claim_id,
                    "zone_id": row.geo_zone_id,
                    "trigger_type": row.trigger_type,
                    "trigger_level": row.trigger_level,
                    "trigger_value": float(row.trigger_value)
                    if row.trigger_value
                    else 0.0,
                    "workers_affected": 0,
                    "total_payout": 0.0,
                    "fraud_holds": 0,
                    "fired_at": row.claim_timestamp.isoformat()
                    if row.claim_timestamp
                    else None,
                    "payout_status": row.payout_status,
                }
                result.append(seen[key])
            seen[key]["workers_affected"] += 1
            seen[key]["total_payout"] += (
                float(row.payout_amount) if row.payout_amount else 0.0
            )
            if row.fraud_flag:
                seen[key]["fraud_holds"] += 1

        return result[:5]  # max 5 events
    except Exception as e:
        logger.error(f"Error fetching trigger events: {e}")
        return []


def create_disruption_flag_full(
    db,
    manager_id: int,
    zone_id: str,
    disruption_type: str,
    description: str,
    evidence_url: Optional[str] = None,
    estimated_start: Optional[str] = None,
    estimated_end: Optional[str] = None,
    workers_in_zone: Optional[int] = None,
    estimated_payout: Optional[float] = None,
    affected_worker_ids: Optional[list] = None,
):
    """Create a disruption flag with full fields."""
    # Check manager owns this zone
    mgr = db.execute(
        text("""
        SELECT assigned_zones FROM managers WHERE manager_id = :mid
    """),
        {"mid": manager_id},
    ).fetchone()

    if not mgr or not mgr.assigned_zones or zone_id not in mgr.assigned_zones:
        return {"error": "Unauthorized: zone not assigned to this manager"}

    # Count workers in zone
    worker_count_row = db.execute(
        text("""
        SELECT COUNT(*) FROM workers WHERE geo_zone_id = :zone_id
    """),
        {"zone_id": zone_id},
    ).fetchone()
    worker_count = int(worker_count_row[0]) if worker_count_row else 0

    # Parse timestamps
    from datetime import timedelta

    est_start = None
    est_end = None
    if estimated_start:
        try:
            est_start = datetime.fromisoformat(estimated_start.replace("Z", "+00:00"))
        except Exception:
            est_start = datetime.utcnow()
    if estimated_end:
        try:
            est_end = datetime.fromisoformat(estimated_end.replace("Z", "+00:00"))
        except Exception:
            est_end = datetime.utcnow() + timedelta(hours=6)

    # Use frontend-computed count if provided, else use DB count
    final_worker_count = workers_in_zone if workers_in_zone is not None else worker_count
    final_payout = estimated_payout  # Can be None if no route check was done
    final_affected_ids = affected_worker_ids or []  # List of real DB worker IDs

    result = db.execute(
        text("""
        INSERT INTO manager_disruption_flags (
            manager_id, zone_id, disruption_type, description,
            evidence_url, estimated_start, estimated_end,
            flag_status, payout_enabled, created_at, route_feasible,
            workers_in_zone, estimated_payout, affected_worker_ids
        )
        VALUES (
            :manager_id, :zone_id, :disruption_type, :description,
            :evidence_url, :estimated_start, :estimated_end,
            'pending', false, NOW(), false,
            :workers_in_zone, :estimated_payout, :affected_worker_ids
        )
        RETURNING flag_id
    """),
        {
            "manager_id": manager_id,
            "zone_id": zone_id,
            "disruption_type": disruption_type,
            "description": description,
            "evidence_url": evidence_url,
            "estimated_start": est_start,
            "estimated_end": est_end,
            "workers_in_zone": final_worker_count,
            "estimated_payout": final_payout,
            "affected_worker_ids": final_affected_ids if final_affected_ids else None,
        },
    )
    flag_id = result.fetchone()[0]
    db.commit()

    logger.info(
        f"[FLAG] Manager {manager_id} created flag {flag_id} for zone {zone_id}"
    )

    return {
        "flag_id": flag_id,
        "zone_id": zone_id,
        "disruption_type": disruption_type,
        "flag_status": "pending",
        "payout_enabled": False,
        "workers_in_zone": worker_count,
        "message": "Flag submitted. Awaiting admin verification.",
    }


def get_manager_flags_all(db, manager_id: int):
    """Get all flags for a manager with full detail."""
    rows = db.execute(
        text("""
        SELECT flag_id, manager_id, zone_id, disruption_type, description,
               evidence_url, estimated_start, estimated_end, flag_status,
               payout_enabled, created_at, admin_verified, verified_at,
               route_feasible, workers_in_zone, estimated_payout
        FROM manager_disruption_flags
        WHERE manager_id = :mid
        ORDER BY created_at DESC
    """),
        {"mid": manager_id},
    ).fetchall()

    result = []
    for row in rows:
        created_iso = row.created_at.isoformat() if row.created_at else None
        result.append(
            {
                "flag_id": row.flag_id,
                "manager_id": row.manager_id,
                "zone_id": row.zone_id,
                "disruption_type": row.disruption_type,
                "description": row.description,
                "evidence_url": row.evidence_url,
                "estimated_start": row.estimated_start.isoformat()
                if row.estimated_start
                else None,
                "estimated_end": row.estimated_end.isoformat()
                if row.estimated_end
                else None,
                "flag_status": row.flag_status,
                "payout_enabled": row.payout_enabled,
                # Both field names for backwards compat
                "flagged_at": created_iso,
                "created_at": created_iso,
                "admin_verified": row.admin_verified,
                "verified_at": row.verified_at.isoformat() if row.verified_at else None,
                "route_feasible": row.route_feasible,
                "workers_in_zone": row.workers_in_zone,
                "estimated_payout": float(row.estimated_payout) if row.estimated_payout else None,
            }
        )
    return result
