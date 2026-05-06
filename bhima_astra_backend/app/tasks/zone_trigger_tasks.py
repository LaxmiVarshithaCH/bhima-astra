from app.tasks.celery_app import celery
from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.db.models.worker import Worker
from app.tasks.trigger_tasks import trigger_task
from app.utils.redis_client import redis_client
import json
import logging

logger = logging.getLogger("bhima.zone_trigger_tasks")


@celery.task
def zone_trigger_task(zone_id: str):
    """
    Trigger worker-level evaluation for all active workers in a zone.
    
    Called when zone-level ML models detect disruption.
    Iterates through all workers in zone and triggers individual risk evaluation
    through the Trigger Agent, which uses real ML predictions.
    
    No mock thresholds - all decisions flow from ML model outputs.
    """
    db: Session = SessionLocal()

    try:
        logger.info(f"[ZONE TRIGGER] Processing zone: {zone_id}")

        # Get zone context from cached ML computation
        zone_cache_key = f"zone_live:{zone_id}"
        zone_context = {}
        
        try:
            cached = redis_client.get(zone_cache_key)
            if cached:
                zone_context = json.loads(cached)
        except Exception as e:
            logger.warning(f"[ZONE TRIGGER] Could not retrieve zone context for {zone_id}: {e}")

        # Get all active workers in this zone
        workers = db.query(Worker).filter(
            Worker.geo_zone_id == zone_id
        ).all()

        logger.info(f"[ZONE TRIGGER] Found {len(workers)} workers in zone {zone_id} "
                   f"(disruption_prob={zone_context.get('disruption_probability', 'N/A')}, "
                   f"zone_risk={zone_context.get('zone_risk_score', 'N/A')})")

        # 🔥 Trigger individual worker evaluation for each worker
        for worker in workers:
            logger.debug(f"[ZONE TRIGGER] Queuing trigger evaluation for worker {worker.worker_id}")
            trigger_task.delay(worker.worker_id)

        logger.info(f"[ZONE TRIGGER] Queued {len(workers)} worker evaluations for zone {zone_id}")
        
        return {
            "status": "zone_triggered",
            "zone_id": zone_id,
            "workers_triggered": len(workers),
            "zone_context": zone_context
        }

    except Exception as e:
        logger.error(f"[ZONE TRIGGER] Error processing zone {zone_id}: {e}")
        return {
            "status": "error",
            "zone_id": zone_id,
            "error": str(e)
        }
    
    finally:
        db.close()