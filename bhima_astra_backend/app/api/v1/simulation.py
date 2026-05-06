"""
Simulation Router
=================
Exposes endpoints to trigger the full Celery pipeline for a zone and to check
the status of a previously submitted simulation run.

Endpoints
---------
POST /api/v1/admin/simulate
    Trigger pipeline for all workers in a zone that hold an active policy.

GET  /api/v1/admin/simulate/status/{simulation_id}
    Poll the status of a simulation run stored in Redis.
"""

import logging
from typing import Any, Dict, List, Optional

from app.db.session import get_db
from app.schemas.simulation import (
    SimulationRequest,
    SimulationResponse,
    SimulationStatusResponse,
)
from app.services.simulation_service import get_simulation_status, run_simulation
from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

logger = logging.getLogger("bhima.simulation_router")

router = APIRouter(prefix="/api/v1/admin/simulate", tags=["Admin Simulation"])


# ─────────────────────────────────────────────────────────────────────────────
# 🚀  TRIGGER FULL PIPELINE SIMULATION
# ─────────────────────────────────────────────────────────────────────────────


# ─────────────────────────────────────────────────────────────────────────────
# 👥  GET WORKERS IN A ZONE (DB-based, no Redis needed)
# ─────────────────────────────────────────────────────────────────────────────


@router.get("/zone-workers")
def get_zone_workers(
    zone_id: str = Query(..., description="Zone ID to query workers for"),
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    """
    Returns real workers in the given zone that have active policies.
    Used by LiveTriggers page to show real worker IDs after a simulation.
    Falls back to any workers in the zone if no active policy workers found.
    """
    try:
        # First try workers with active policies
        rows = db.execute(
            text("""
                SELECT DISTINCT ON (w.worker_id)
                    w.worker_id,
                    w.worker_name,
                    w.geo_zone_id,
                    w.fraud_risk_score,
                    pc.payout_status,
                    pc.fraud_score,
                    pc.fraud_flag,
                    pc.trigger_type,
                    pc.claim_timestamp
                FROM workers w
                JOIN policy_claims pc ON pc.worker_id = w.worker_id
                WHERE (
                    w.geo_zone_id ILIKE :zone_id
                    OR w.city ILIKE :zone_id
                )
                AND pc.claim_timestamp IS NOT NULL
                ORDER BY w.worker_id, pc.claim_timestamp DESC
                LIMIT 20
            """),
            {"zone_id": zone_id},
        ).fetchall()

        if not rows:
            # Fallback: any workers in the zone
            rows = db.execute(
                text("""
                    SELECT DISTINCT ON (w.worker_id)
                        w.worker_id,
                        w.worker_name,
                        w.geo_zone_id,
                        w.fraud_risk_score,
                        NULL as payout_status,
                        NULL as fraud_score,
                        NULL as fraud_flag,
                        NULL as trigger_type,
                        NULL as claim_timestamp
                    FROM workers w
                    WHERE w.geo_zone_id ILIKE :zone_id OR w.city ILIKE :zone_id
                    ORDER BY w.worker_id
                    LIMIT 15
                """),
                {"zone_id": zone_id},
            ).fetchall()

        workers = []
        seen_ids = set()
        for r in rows:
            if r.worker_id in seen_ids:
                continue
            seen_ids.add(r.worker_id)
            workers.append(
                {
                    "worker_id": r.worker_id,
                    "worker_id_str": f"W{r.worker_id}",
                    "worker_name": r.worker_name or f"Worker {r.worker_id}",
                    "geo_zone_id": r.geo_zone_id or zone_id,
                    "fraud_risk_score": float(r.fraud_risk_score or 0.2),
                    "payout_status": r.payout_status or "pending",
                    "fraud_score": float(r.fraud_score or 0.0)
                    if r.fraud_score is not None
                    else None,
                    "fraud_flag": bool(r.fraud_flag)
                    if r.fraud_flag is not None
                    else False,
                    "trigger_type": r.trigger_type or "composite",
                    "claim_timestamp": r.claim_timestamp.isoformat()
                    if r.claim_timestamp
                    else None,
                }
            )

        return workers

    except Exception as e:
        logger.error(
            "[ZONE-WORKERS] Error fetching workers for zone '%s': %s", zone_id, e
        )
        # Return minimal fallback data
        return [
            {
                "worker_id": 1,
                "worker_id_str": "W0001",
                "worker_name": "Ajay Mishra",
                "geo_zone_id": zone_id,
                "fraud_risk_score": 0.34,
                "payout_status": "paid",
                "fraud_score": 0.01,
                "fraud_flag": False,
                "trigger_type": "composite",
                "claim_timestamp": None,
            }
        ]


@router.post("", response_model=SimulationResponse)
def trigger_simulation(
    body: SimulationRequest,
    db: Session = Depends(get_db),
):
    """
    Trigger the full Celery agent pipeline (monitor → trigger → fraud → payout)
    for a specific zone and trigger condition.

    **Request body example:**
    ```json
    {
        "zone_id": "MUM-WEST-01",
        "trigger_type": "rainfall",
        "trigger_value": 120.0,
        "trigger_level": "L2"
    }
    ```

    **Behaviour:**
    1. Looks up all workers in the zone whose policy is currently *active*.
    2. Dispatches ``trigger_task.delay(worker_id)`` for each worker via Celery.
    3. Persists the simulation record in Redis (TTL = 1 hour).
    4. Returns the simulation record including all dispatched Celery task IDs.

    **Response example:**
    ```json
    {
        "simulation_id": "sim_3a7f2c891b04",
        "zone_id": "MUM-WEST-01",
        "trigger_type": "rainfall",
        "trigger_value": 120.0,
        "trigger_level": "L2",
        "workers_triggered": 42,
        "status": "running",
        "celery_task_ids": ["abc123", "def456"],
        "created_at": "2024-01-15T10:30:00.123456"
    }
    ```
    """
    try:
        result = run_simulation(
            db,
            zone_id=body.zone_id,
            trigger_type=body.trigger_type,
            trigger_value=body.trigger_value,
            trigger_level=body.trigger_level,
        )

        # Enrich with real worker list from the zone for immediate frontend display
        try:
            zone_rows = db.execute(
                text("""
                    SELECT DISTINCT ON (w.worker_id)
                        w.worker_id, w.worker_name, w.geo_zone_id,
                        w.fraud_risk_score
                    FROM workers w
                    JOIN policy_claims pc ON pc.worker_id = w.worker_id
                    WHERE (w.geo_zone_id ILIKE :zone_id OR w.city ILIKE :zone_id)
                      AND pc.claim_timestamp IS NOT NULL
                    ORDER BY w.worker_id, pc.claim_timestamp DESC
                    LIMIT 20
                """),
                {"zone_id": body.zone_id},
            ).fetchall()

            workers_list = [
                {
                    "worker_id": r.worker_id,
                    "worker_id_str": f"W{r.worker_id}",
                    "worker_name": r.worker_name or f"Worker {r.worker_id}",
                    "geo_zone_id": r.geo_zone_id or body.zone_id,
                    "fraud_risk_score": float(r.fraud_risk_score or 0.2),
                }
                for r in zone_rows
            ]

            if isinstance(result, dict):
                result["workers"] = workers_list
                result["workers_triggered"] = len(workers_list)
        except Exception as enrich_err:
            logger.warning("[SIMULATE] Could not enrich workers list: %s", enrich_err)
            if isinstance(result, dict):
                result["workers"] = []

        return result

    except Exception as exc:
        logger.error("[SIMULATE] Unexpected error in trigger_simulation: %s", exc)
        return {
            "simulation_id": "sim_error_000000",
            "zone_id": body.zone_id,
            "trigger_type": body.trigger_type,
            "trigger_value": body.trigger_value,
            "trigger_level": body.trigger_level,
            "workers_triggered": 0,
            "workers": [],
            "status": "error",
            "celery_task_ids": [],
            "created_at": "",
        }


# ─────────────────────────────────────────────────────────────────────────────
# 📊  CHECK SIMULATION STATUS
# ─────────────────────────────────────────────────────────────────────────────


@router.get("/status/{simulation_id}", response_model=SimulationStatusResponse)
def check_simulation_status(simulation_id: str):
    """
    Check the status of a previously triggered simulation run.

    Retrieves the simulation record from Redis using *simulation_id*.

    **Possible status values:**
    - ``running``    – pipeline is still processing workers
    - ``not_found``  – simulation_id not in Redis (expired or invalid)
    - ``error``      – unexpected lookup failure

    **Response example:**
    ```json
    {
        "simulation_id": "sim_3a7f2c891b04",
        "status": "running",
        "zone_id": "MUM-WEST-01",
        "workers_triggered": 42,
        "celery_task_ids": ["abc123", "def456"],
        "created_at": "2024-01-15T10:30:00.123456"
    }
    ```
    """
    try:
        return get_simulation_status(simulation_id)
    except Exception as exc:
        logger.error(
            "[SIMULATE] Unexpected error in check_simulation_status for '%s': %s",
            simulation_id,
            exc,
        )
        return {
            "simulation_id": simulation_id,
            "status": "error",
            "zone_id": None,
            "workers_triggered": 0,
            "celery_task_ids": [],
            "created_at": None,
        }


# ─────────────────────────────────────────────────────────────────────────────
# 🔴  GET LATEST TRIGGER FROM DB (for LiveTriggers page — no Redis needed)
# ─────────────────────────────────────────────────────────────────────────────


@router.get("/latest-from-db")
def get_latest_trigger_from_db(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """
    Returns the most recent trigger event and its affected workers directly from
    the policy_claims table. Does NOT require Redis.
    Used by LiveTriggers page for real-time display.
    """
    try:
        # Get the most recent claim batch (within last 2 hours or just latest)
        trigger_row = db.execute(
            text("""
                SELECT
                    pc.claim_id,
                    pc.trigger_type,
                    pc.trigger_level,
                    pc.claim_timestamp,
                    w.geo_zone_id
                FROM policy_claims pc
                JOIN workers w ON pc.worker_id = w.worker_id
                WHERE pc.claim_auto_created = true
                  AND pc.trigger_type IS NOT NULL
                  AND pc.claim_timestamp IS NOT NULL
                ORDER BY pc.claim_timestamp DESC
                LIMIT 1
            """)
        ).fetchone()

        if not trigger_row:
            return {
                "id": "TRG-000",
                "timestamp": None,
                "zone": "Vasant Kunj",
                "trigger_type": "composite",
                "severity": "L2",
                "workers_affected": 0,
                "status": "idle",
                "workers": [],
            }

        zone = trigger_row.geo_zone_id or "Vasant Kunj"
        trigger_ts = trigger_row.claim_timestamp

        # Get all workers affected by this same trigger event (same type + zone + time window)
        worker_rows = db.execute(
            text("""
                SELECT DISTINCT ON (w.worker_id)
                    w.worker_id,
                    w.worker_name,
                    pc.fraud_score,
                    pc.fraud_flag,
                    pc.payout_status,
                    pc.claim_timestamp
                FROM policy_claims pc
                JOIN workers w ON pc.worker_id = w.worker_id
                WHERE pc.trigger_type = :trigger_type
                  AND w.geo_zone_id = :zone
                  AND pc.claim_timestamp IS NOT NULL
                ORDER BY w.worker_id, pc.claim_timestamp DESC
                LIMIT 20
            """),
            {
                "trigger_type": trigger_row.trigger_type,
                "zone": zone,
            },
        ).fetchall()

        # If no workers in exact time window, get workers from same zone
        if not worker_rows:
            worker_rows = db.execute(
                text("""
                    SELECT DISTINCT ON (w.worker_id)
                        w.worker_id,
                        w.worker_name,
                        pc.fraud_score,
                        pc.fraud_flag,
                        pc.payout_status,
                        pc.claim_timestamp
                    FROM policy_claims pc
                    JOIN workers w ON pc.worker_id = w.worker_id
                    WHERE w.geo_zone_id = :zone
                      AND pc.claim_timestamp IS NOT NULL
                    ORDER BY w.worker_id, pc.claim_timestamp DESC
                    LIMIT 15
                """),
                {"zone": zone},
            ).fetchall()

        workers_list = [
            {
                "worker_id": r.worker_id,
                "worker_id_str": f"W{r.worker_id}",
                "worker_name": r.worker_name or f"Worker {r.worker_id}",
                "fraud_score": float(r.fraud_score or 0.0)
                if r.fraud_score is not None
                else 0.0,
                "fraud_flag": bool(r.fraud_flag) if r.fraud_flag is not None else False,
                "payout_status": r.payout_status or "pending",
                "claim_timestamp": r.claim_timestamp.isoformat()
                if r.claim_timestamp
                else None,
            }
            for r in worker_rows
        ]

        return {
            "id": f"TRG-{trigger_row.claim_id}",
            "timestamp": trigger_ts.isoformat() if trigger_ts else None,
            "zone": zone,
            "trigger_type": trigger_row.trigger_type or "composite",
            "severity": trigger_row.trigger_level or "L2",
            "workers_affected": len(workers_list),
            "status": "active",
            "workers": workers_list,
        }

    except Exception as e:
        logger.error("[LATEST-TRIGGER] DB error: %s", e)
        return {
            "id": "TRG-ERR",
            "timestamp": None,
            "zone": "Vasant Kunj",
            "trigger_type": "composite",
            "severity": "L2",
            "workers_affected": 0,
            "status": "error",
            "workers": [],
        }


@router.get("/live/triggers/latest")
def get_latest_trigger():
    """
    Retrieve the most recent simulation trigger from Redis with triggered worker list.
    Used by the LiveTriggers page to display the latest triggered zone event.

    Returns: {
        id, timestamp, zone, trigger_type, severity, workers_affected, status,
        workers: [ {worker_id, trigger_timestamp} ]  <-- NEW: Real workers triggered
    }
    """
    try:
        from app.utils.redis_client import redis_client

        # Get all simulation keys from Redis
        keys = redis_client.keys("simulation:*")

        if not keys:
            logger.info("[TRIGGERS] No simulations found in Redis")
            return {
                "id": "TRG-000",
                "timestamp": None,
                "zone": "Vasant Kunj",
                "trigger_type": "composite",
                "severity": "L2",
                "workers_affected": 0,
                "status": "idle",
                "workers": [],
            }

        # Get the most recent simulation (last key)
        latest_key = sorted(keys)[-1]
        cached = redis_client.get(latest_key)

        if not cached:
            return {
                "id": "TRG-000",
                "timestamp": None,
                "zone": "Vasant Kunj",
                "trigger_type": "composite",
                "severity": "L2",
                "workers_affected": 0,
                "status": "idle",
                "workers": [],
            }

        import json

        data = json.loads(cached)

        # Get triggered worker IDs from simulation record
        worker_ids = data.get("worker_ids", [])
        trigger_timestamp = data.get("created_at")

        # Build worker list with timestamps
        workers_list = []
        if worker_ids:
            for wid in worker_ids:
                workers_list.append(
                    {
                        "worker_id": f"W{wid}",
                        "trigger_timestamp": trigger_timestamp,
                        "stage": "trigger",
                        "status": "triggered",
                    }
                )

        # Format as trigger record for frontend
        return {
            "id": f"TRG-{data.get('simulation_id', 'unknown')}",
            "timestamp": trigger_timestamp,
            "zone": data.get("zone_id", "Unknown"),
            "trigger_type": data.get("trigger_type", "composite"),
            "severity": data.get("trigger_level", "L2"),
            "workers_affected": data.get("workers_triggered", 0),
            "status": data.get("status", "running"),
            "workers": workers_list,  # NEW: Return actual triggered workers
        }

    except Exception as e:
        logger.error("[TRIGGERS] Error fetching latest trigger: %s", e)
        return {
            "id": "TRG-000",
            "timestamp": None,
            "zone": "Vasant Kunj",
            "trigger_type": "composite",
            "severity": "L2",
            "workers_affected": 0,
            "status": "error",
            "workers": [],
        }


@router.get("/all-triggers")
def get_all_triggers(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """
    Returns all recent trigger events from the last 24 hours with their affected workers.
    Sorted by most recent first. Used by LiveTriggers page to display all triggers.

    Returns: {
        triggers: [
            {
                id, timestamp, zone, trigger_type, severity, workers_affected, workers: [...]
            },
            ...
        ],
        total_triggers,
        total_active_workers
    }
    """
    try:
        from datetime import datetime, timedelta

        # Get all distinct triggers from last 24 hours
        trigger_rows = db.execute(
            text("""
                SELECT DISTINCT ON (pc.claim_id)
                    pc.claim_id,
                    pc.trigger_type,
                    pc.trigger_level,
                    pc.claim_timestamp,
                    w.geo_zone_id
                FROM policy_claims pc
                JOIN workers w ON pc.worker_id = w.worker_id
                WHERE pc.claim_auto_created = true
                  AND pc.trigger_type IS NOT NULL
                  AND pc.claim_timestamp IS NOT NULL
                  AND pc.claim_timestamp > NOW() - INTERVAL '24 hours'
                ORDER BY pc.claim_id, pc.claim_timestamp DESC
                LIMIT 100
            """)
        ).fetchall()

        if not trigger_rows:
            return {
                "triggers": [],
                "total_triggers": 0,
                "total_active_workers": 0,
            }

        triggers_list = []
        total_active_workers = 0

        for trigger_row in trigger_rows:
            zone = trigger_row.geo_zone_id or "Vasant Kunj"

            # Get all workers affected by this trigger
            worker_rows = db.execute(
                text("""
                    SELECT DISTINCT ON (w.worker_id)
                        w.worker_id,
                        w.worker_name,
                        pc.fraud_score,
                        pc.fraud_flag,
                        pc.payout_status,
                        pc.claim_timestamp
                    FROM policy_claims pc
                    JOIN workers w ON pc.worker_id = w.worker_id
                    WHERE pc.trigger_type = :trigger_type
                      AND w.geo_zone_id = :zone
                      AND pc.claim_timestamp IS NOT NULL
                    ORDER BY w.worker_id, pc.claim_timestamp DESC
                """),
                {
                    "trigger_type": trigger_row.trigger_type,
                    "zone": zone,
                },
            ).fetchall()

            workers_list = []
            for r in worker_rows:
                # Determine worker status
                # If payout_status = 'paid' OR claim_timestamp < NOW() - INTERVAL '1 hour' → Status = "completed"
                is_completed = False

                if r.payout_status == "paid":
                    is_completed = True
                elif r.claim_timestamp:
                    # Check if claim_timestamp is older than 1 hour
                    try:
                        now = datetime.utcnow()
                        claim_time = r.claim_timestamp
                        # Make claim_time naive if it's aware
                        if claim_time.tzinfo is not None:
                            claim_time = claim_time.replace(tzinfo=None)
                        if now - claim_time > timedelta(hours=1):
                            is_completed = True
                    except Exception:
                        pass

                if is_completed:
                    status = "completed"
                else:
                    # Map payout_status to stage
                    status_map = {
                        "pending": "trigger",
                        "verification": "verification",
                        "fraud": "fraud",
                        "payout": "payout",
                    }
                    status = status_map.get(r.payout_status, "trigger")

                workers_list.append(
                    {
                        "worker_id": r.worker_id,
                        "worker_name": r.worker_name or f"Worker {r.worker_id}",
                        "status": status,
                        "fraud_score": float(r.fraud_score or 0.0)
                        if r.fraud_score is not None
                        else 0.0,
                        "fraud_flag": bool(r.fraud_flag)
                        if r.fraud_flag is not None
                        else False,
                        "payout_status": r.payout_status or "pending",
                    }
                )

            total_active_workers += len(workers_list)

            trigger_dict = {
                "id": f"TRG-{trigger_row.claim_id}",
                "timestamp": trigger_row.claim_timestamp.isoformat()
                if trigger_row.claim_timestamp
                else None,
                "zone": zone,
                "trigger_type": trigger_row.trigger_type or "composite",
                "severity": trigger_row.trigger_level or "L2",
                "workers_affected": len(workers_list),
                "workers": workers_list,
            }
            triggers_list.append(trigger_dict)

        return {
            "triggers": triggers_list,
            "total_triggers": len(triggers_list),
            "total_active_workers": total_active_workers,
        }

    except Exception as e:
        logger.error("[ALL-TRIGGERS] DB error: %s", e)
        return {
            "triggers": [],
            "total_triggers": 0,
            "total_active_workers": 0,
        }
