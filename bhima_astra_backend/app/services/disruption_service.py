"""
Disruption Management Service

Handles both environmental disruptions and manager-reported disruption flags.
Combines live environmental data with manager signals for comprehensive disruption tracking.
"""

from datetime import date, datetime
from typing import Dict, List, Optional, Tuple

from app.db.models.daily_operations import DailyOperation
from app.db.models.manager_flags import ManagerDisruptionFlag
from app.db.models.worker import Worker
from sqlalchemy.orm import Session


def get_manager_disruption_flags(
    db: Session, zone_id: Optional[str] = None, status: Optional[str] = None
) -> List[ManagerDisruptionFlag]:
    """
    Fetch manager-reported disruption flags.

    Args:
        db: Database session
        zone_id: Filter by zone (optional)
        status: Filter by status - pending | verified | rejected | resolved (optional)

    Returns:
        List of manager disruption flags
    """
    query = db.query(ManagerDisruptionFlag)

    if zone_id:
        query = query.filter(ManagerDisruptionFlag.zone_id == zone_id)

    if status:
        query = query.filter(ManagerDisruptionFlag.flag_status == status)

    # Order by creation time descending
    query = query.order_by(ManagerDisruptionFlag.created_at.desc())

    return query.all()


def get_environmental_disruptions(
    db: Session, zone_id: Optional[str] = None
) -> List[Dict]:
    """
    Derive environmental disruptions from zone live data (daily_operations).

    Analyzes rainfall, temperature, AQI from latest daily operations for workers in zone.
    Identifies environmental disruptions based on severity thresholds.

    Args:
        db: Database session
        zone_id: Filter by zone (optional)

    Returns:
        List of environmental disruption objects
    """
    disruptions = []

    # Get latest operations for zone
    query = db.query(DailyOperation).join(
        Worker, Worker.worker_id == DailyOperation.worker_id
    )

    if zone_id:
        query = query.filter(Worker.geo_zone_id == zone_id)

    # Get latest operations (grouped by zone)
    ops = query.order_by(DailyOperation.log_id.desc()).all()

    if not ops:
        return []

    # Get unique worker IDs and fetch worker data
    worker_ids = set(op.worker_id for op in ops)
    workers = db.query(Worker).filter(Worker.worker_id.in_(worker_ids)).all()
    worker_dict = {w.worker_id: w for w in workers}

    # Group by zone and analyze conditions
    zone_data = {}
    for op in ops:
        worker = worker_dict.get(op.worker_id)
        if worker and worker.geo_zone_id:
            zone = worker.geo_zone_id
            if zone not in zone_data:
                zone_data[zone] = {
                    "rainfall": [],
                    "temperature": [],
                    "aqi": [],
                    "timestamp": op.date,
                    "workers": set(),
                }
            zone_data[zone]["rainfall"].append(op.rainfall or 0.0)
            zone_data[zone]["temperature"].append(op.temperature or 25.0)
            zone_data[zone]["aqi"].append(op.aqi or 50)
            zone_data[zone]["workers"].add(op.worker_id)

    # Generate disruption items for each zone with conditions
    for zone, data in zone_data.items():
        avg_rainfall = (
            sum(data["rainfall"]) / len(data["rainfall"]) if data["rainfall"] else 0.0
        )
        avg_temp = (
            sum(data["temperature"]) / len(data["temperature"])
            if data["temperature"]
            else 25.0
        )
        avg_aqi = sum(data["aqi"]) / len(data["aqi"]) if data["aqi"] else 50

        # Rainfall disruption (≥64.5mm is L1)
        if avg_rainfall >= 64.5:
            level = (
                "L3"
                if avg_rainfall >= 204.5
                else "L2"
                if avg_rainfall >= 115.6
                else "L1"
            )
            disruptions.append(
                {
                    "zone_id": zone,
                    "disruption_type": "rainfall",
                    "type": "environmental",
                    "rainfall_mm": round(avg_rainfall, 2),
                    "severity_level": level,
                    "composite_score": min(avg_rainfall / 300.0, 1.0),
                    "timestamp": data["timestamp"],
                    "workers_affected": len(data["workers"]),
                    "description": f"Heavy rainfall ({avg_rainfall:.1f}mm) affecting {len(data['workers'])} workers",
                }
            )

        # Temperature disruption (≥40°C is L1)
        if avg_temp >= 40.0:
            level = "L3" if avg_temp >= 45.0 else "L2" if avg_temp >= 42.0 else "L1"
            disruptions.append(
                {
                    "zone_id": zone,
                    "disruption_type": "heat",
                    "type": "environmental",
                    "temperature_celsius": round(avg_temp, 2),
                    "severity_level": level,
                    "composite_score": min((avg_temp - 25.0) / 25.0, 1.0),
                    "timestamp": data["timestamp"],
                    "workers_affected": len(data["workers"]),
                    "description": f"Extreme heat ({avg_temp:.1f}°C) affecting {len(data['workers'])} workers",
                }
            )

        # AQI disruption (≥300 is L1)
        if avg_aqi >= 300:
            level = "L3" if avg_aqi >= 400 else "L2" if avg_aqi >= 350 else "L1"
            disruptions.append(
                {
                    "zone_id": zone,
                    "disruption_type": "aqi",
                    "type": "environmental",
                    "aqi_value": int(avg_aqi),
                    "severity_level": level,
                    "composite_score": min(avg_aqi / 500.0, 1.0),
                    "timestamp": data["timestamp"],
                    "workers_affected": len(data["workers"]),
                    "description": f"Poor air quality (AQI {int(avg_aqi)}) affecting {len(data['workers'])} workers",
                }
            )

    return disruptions


def get_all_disruptions(
    db: Session, zone_id: Optional[str] = None
) -> Tuple[List[Dict], List[ManagerDisruptionFlag]]:
    """
    Get combined environmental and manager-reported disruptions.

    Args:
        db: Database session
        zone_id: Filter by zone (optional)

    Returns:
        Tuple of (environmental_disruptions, manager_flags)
    """
    environmental = get_environmental_disruptions(db, zone_id)
    manager_flags = get_manager_disruption_flags(db, zone_id)

    return environmental, manager_flags


def combine_disruptions(
    environmental: List[Dict], manager_flags: List[ManagerDisruptionFlag]
) -> List[Dict]:
    """
    Combine environmental and manager disruptions into single sorted list.

    Sorts by severity level (L3 > L2 > L1) and then by timestamp (newest first).

    Args:
        environmental: List of environmental disruption dicts
        manager_flags: List of manager disruption flag objects

    Returns:
        Combined and sorted list
    """
    combined = []

    # Add environmental disruptions
    for env in environmental:
        combined.append(
            {
                "disruption_id": f"{env['zone_id']}_env_{env['disruption_type']}",
                "type": "environmental",
                "zone_id": env["zone_id"],
                "disruption_type": env["disruption_type"],
                "description": env.get("description"),
                "severity_level": env.get("severity_level"),
                "timestamp": env.get("timestamp"),
                "workers_affected": env.get("workers_affected"),
                "environmental_data": env,
            }
        )

    # Add manager flags
    for flag in manager_flags:
        # Map flag_status to severity-like ordering
        severity_map = {
            "verified": "L1",  # Verified disruptions are high priority
            "pending": "L2",
            "resolved": "L3",
            "rejected": None,
        }
        severity = severity_map.get(flag.flag_status, "L2")

        if flag.flag_status != "rejected":  # Skip rejected flags
            combined.append(
                {
                    "disruption_id": flag.flag_id,
                    "type": "manager_flag",
                    "zone_id": flag.zone_id,
                    "disruption_type": flag.disruption_type,
                    "description": flag.description,
                    "severity_level": severity,
                    "status": flag.flag_status,
                    "timestamp": flag.created_at or datetime.now(),
                    "workers_affected": flag.workers_in_zone,
                    "estimated_payout": flag.estimated_payout,
                    "manager_flag_data": flag,
                }
            )

    # Sort: first by severity (L1 > L2 > L3), then by timestamp (newest first)
    severity_order = {"L1": 0, "L2": 1, "L3": 2, None: 3}

    def _ts(x):
        ts = x.get("timestamp")
        if ts is None:
            return 0
        try:
            # datetime.date objects don't have .timestamp(); convert first
            if isinstance(ts, date) and not isinstance(ts, datetime):
                ts = datetime(ts.year, ts.month, ts.day)
            return -ts.timestamp()
        except Exception:
            return 0

    combined.sort(
        key=lambda x: (
            severity_order.get(x.get("severity_level"), 3),
            _ts(x),
        )
    )

    return combined


def update_manager_flag(
    db: Session,
    flag_id: int,
    action: str,
    admin_id: int,
    notes: Optional[str] = None,
    payout_enabled: Optional[bool] = None,
) -> Optional[ManagerDisruptionFlag]:
    """
    Update manager disruption flag status after admin review.

    Args:
        db: Database session
        flag_id: Flag ID to update
        action: Action to take - "verify" or "reject"
        admin_id: Admin ID performing the action
        notes: Optional notes from admin
        payout_enabled: Whether to enable payouts for this disruption

    Returns:
        Updated flag or None if not found
    """
    flag = (
        db.query(ManagerDisruptionFlag)
        .filter(ManagerDisruptionFlag.flag_id == flag_id)
        .first()
    )

    if not flag:
        return None

    # Update based on action
    if action == "verify":
        flag.flag_status = "verified"
        flag.admin_verified = True
        flag.verified_by = admin_id
        flag.verified_at = datetime.utcnow()
        if payout_enabled is not None:
            flag.payout_enabled = payout_enabled
    elif action == "reject":
        flag.flag_status = "rejected"
        flag.admin_verified = False
        flag.verified_by = admin_id
        flag.verified_at = datetime.utcnow()
        flag.payout_enabled = False

    db.commit()
    db.refresh(flag)

    return flag


def resolve_manager_flag(db: Session, flag_id: int) -> Optional[ManagerDisruptionFlag]:
    """
    Mark a manager flag as resolved.

    Args:
        db: Database session
        flag_id: Flag ID to resolve

    Returns:
        Updated flag or None if not found
    """
    flag = (
        db.query(ManagerDisruptionFlag)
        .filter(ManagerDisruptionFlag.flag_id == flag_id)
        .first()
    )

    if not flag:
        return None

    flag.flag_status = "resolved"
    db.commit()
    db.refresh(flag)

    return flag
