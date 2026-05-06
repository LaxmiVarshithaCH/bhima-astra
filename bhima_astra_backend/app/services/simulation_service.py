"""
Simulation Service
==================
Triggers the full Celery pipeline (monitor → trigger → fraud → payout)
for a given zone and trigger condition.

Fetches all workers in the zone with active policies, dispatches
trigger_task.delay(worker_id) for each, and persists the simulation
record in Redis so the status endpoint can retrieve it later.
"""

import json
import logging
import uuid
from datetime import datetime
from typing import Any, Dict, List

from app.utils.redis_client import redis_client
from sqlalchemy import text
from sqlalchemy.orm import Session

logger = logging.getLogger("bhima.simulation_service")

# Simulation records expire after 1 hour
SIMULATION_TTL = 3600


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def run_simulation(
    db: Session,
    zone_id: str,
    trigger_type: str,
    trigger_value: float,
    trigger_level: str,
) -> Dict[str, Any]:
    """
    Trigger the full Celery pipeline for every worker in *zone_id* that holds
    an active policy.

    Steps
    -----
    1. Query DB for worker_ids in the zone with policy_status = 'active'.
    2. Dispatch ``trigger_task.delay(worker_id)`` for each worker.
    3. Persist the simulation record in Redis (TTL = 1 hour).
    4. Return the simulation record.

    Never raises – always returns a valid dict even if DB or Redis fail.
    """
    simulation_id = f"sim_{uuid.uuid4().hex[:12]}"
    celery_task_ids: List[str] = []
    workers_triggered = 0

    # ------------------------------------------------------------------
    # 1. Fetch workers in zone with active policies
    # ------------------------------------------------------------------
    try:
        # First try: fetch workers in zone with active policies
        rows = db.execute(
            text("""
                SELECT DISTINCT w.worker_id
                FROM workers w
                JOIN policy_claims pc ON pc.worker_id = w.worker_id
                WHERE (
                    w.geo_zone_id = :zone_id
                    OR w.city ILIKE :zone_id
                )
                AND pc.policy_status = 'active'
                ORDER BY w.worker_id
            """),
            {"zone_id": zone_id},
        ).fetchall()

        worker_ids: List[int] = [r.worker_id for r in rows]
        workers_triggered = len(worker_ids)
        
        # If no workers found with active policy, fallback to ANY workers in zone
        if workers_triggered == 0:
            logger.info(
                "[SIM] No active-policy workers found in '%s', trying all workers",
                zone_id,
            )
            rows = db.execute(
                text("""
                    SELECT DISTINCT w.worker_id
                    FROM workers w
                    WHERE (
                        w.geo_zone_id = :zone_id
                        OR w.city ILIKE :zone_id
                    )
                    ORDER BY w.worker_id
                """),
                {"zone_id": zone_id},
            ).fetchall()
            worker_ids: List[int] = [r.worker_id for r in rows]
            workers_triggered = len(worker_ids)
        
        logger.info(
            "[SIM] %s – found %d workers in zone '%s'",
            simulation_id,
            workers_triggered,
            zone_id,
        )

    except Exception as db_err:
        logger.error(
            "[SIM] DB error fetching zone workers for '%s': %s", zone_id, db_err
        )
        worker_ids = []
        workers_triggered = 0

    # ------------------------------------------------------------------
    # 2. Dispatch Celery trigger tasks
    # Use celery.send_task by name to avoid circular import issues that
    # arise when trigger_tasks imports celery_app which in turn tries to
    # import trigger_tasks again during module initialisation.
    # ------------------------------------------------------------------
    try:
        from app.tasks.celery_app import celery as celery_app

        for worker_id in worker_ids:
            try:
                task = celery_app.send_task(
                    "app.tasks.trigger_tasks.trigger_task",
                    args=[worker_id],
                )
                celery_task_ids.append(task.id)
                logger.debug(
                    "[SIM] Dispatched trigger_task for worker=%d, task=%s",
                    worker_id,
                    task.id,
                )
            except Exception as task_err:
                logger.warning(
                    "[SIM] Failed to dispatch trigger_task for worker=%d: %s",
                    worker_id,
                    task_err,
                )
                celery_task_ids.append(f"dispatch_error_{worker_id}")

    except Exception as celery_err:
        logger.error("[SIM] Could not dispatch Celery tasks: %s", celery_err)

    # ------------------------------------------------------------------
    # 3. Build and persist simulation record
    # ------------------------------------------------------------------
    simulation_record: Dict[str, Any] = {
        "simulation_id": simulation_id,
        "zone_id": zone_id,
        "trigger_type": trigger_type,
        "trigger_value": trigger_value,
        "trigger_level": trigger_level,
        "workers_triggered": workers_triggered,
        "worker_ids": worker_ids,  # NEW: Store actual list of triggered worker IDs
        "celery_task_ids": celery_task_ids,
        "status": "running",
        "created_at": datetime.utcnow().isoformat(),
    }

    try:
        redis_client.setex(
            f"simulation:{simulation_id}",
            SIMULATION_TTL,
            json.dumps(simulation_record),
        )
        logger.info(
            "[SIM] Stored simulation record '%s' in Redis (TTL=%ds)",
            simulation_id,
            SIMULATION_TTL,
        )
    except Exception as redis_err:
        logger.warning(
            "[SIM] Redis store failed for '%s': %s", simulation_id, redis_err
        )

    return simulation_record


def get_simulation_status(simulation_id: str) -> Dict[str, Any]:
    """
    Retrieve a simulation record from Redis by *simulation_id*.

    Returns a ``not_found`` sentinel dict if the key has expired or never
    existed, and an ``error`` sentinel on unexpected failures.
    """
    try:
        cached = redis_client.get(f"simulation:{simulation_id}")
        if cached:
            data: Dict[str, Any] = json.loads(cached)
            # In production we'd inspect each AsyncResult to derive a richer
            # status.  For now we surface the stored status directly.
            return data

        logger.info("[SIM] Status lookup miss for '%s'", simulation_id)
        return {
            "simulation_id": simulation_id,
            "status": "not_found",
            "zone_id": None,
            "trigger_type": None,
            "trigger_value": None,
            "trigger_level": None,
            "workers_triggered": 0,
            "celery_task_ids": [],
            "created_at": None,
        }

    except Exception as e:
        logger.error("[SIM] Status lookup error for '%s': %s", simulation_id, e)
        return {
            "simulation_id": simulation_id,
            "status": "error",
            "zone_id": None,
            "trigger_type": None,
            "trigger_value": None,
            "trigger_level": None,
            "workers_triggered": 0,
            "celery_task_ids": [],
            "created_at": None,
        }
