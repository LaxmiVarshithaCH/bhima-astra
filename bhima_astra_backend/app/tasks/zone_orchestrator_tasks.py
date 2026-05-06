from app.tasks.celery_app import celery
from app.db.session import SessionLocal
from app.db.models.worker import Worker
from app.tasks.zone_trigger_tasks import zone_trigger_task
from app.utils.redis_client import redis_client
from app.services.zone_service import compute_zone_live_data
import json
import logging

logger = logging.getLogger("bhima.zone_orchestrator")


@celery.task
def zone_orchestrator_task():
    """
    Orchestrate zone-level disruption detection using ML models.
    
    Evaluates each zone's risk using XGBoost predictions and triggers
    worker claim evaluation only when ML model indicates disruption likelihood.
    
    Replaces mock threshold logic with real ML decision boundaries.
    """
    db = SessionLocal()

    try:
        logger.info("[ZONE ORCHESTRATOR] Starting zone orchestration with ML models...")

        # 🔥 STEP 1: Get all distinct zones
        zones = db.query(Worker.geo_zone_id).distinct().all()
        zones_processed = 0
        zones_triggered = 0

        for z in zones:
            zone_id = z[0]
            
            if not zone_id:
                continue

            try:
                # 🔥 STEP 2: Compute zone-level ML risk prediction (freshly computed, not cached)
                # This ensures we use the latest model predictions for each zone
                zone_data = compute_zone_live_data(db, zone_id)
                
                zones_processed += 1

                # 🔥 STEP 3: Use ML-based decision logic (replaces mock boolean check)
                # Zone triggers when model predicts disruption_probability > 0.50 OR zone_risk > 0.65
                trigger_recommended = zone_data.get("trigger_recommended", False)
                disruption_prob = zone_data.get("disruption_probability", 0.0)
                zone_risk = zone_data.get("zone_risk_score", 0.0)

                if not trigger_recommended:
                    logger.debug(f"[ZONE ORCHESTRATOR] No disruption in {zone_id} "
                               f"(prob={disruption_prob:.3f}, risk={zone_risk:.3f})")
                    continue

                logger.info(f"[ZONE ORCHESTRATOR] ML TRIGGER FIRED for {zone_id} "
                           f"(disruption_prob={disruption_prob:.3f}, zone_risk={zone_risk:.3f})")

                # 🔥 STEP 4: Trigger zone-level worker evaluation
                zone_trigger_task.delay(zone_id)
                zones_triggered += 1
                
                # 🔥 Cache the zone data for dashboard/API access
                cache_key = f"zone_live:{zone_id}"
                redis_client.setex(cache_key, 300, json.dumps(zone_data))

            except Exception as e:
                logger.error(f"[ZONE ORCHESTRATOR] Error processing zone {zone_id}: {e}")
                continue

        logger.info(f"[ZONE ORCHESTRATOR] Completed: {zones_processed} zones processed, "
                   f"{zones_triggered} zones triggered (ML-based)")

    finally:
        db.close()

    return f"zone orchestration complete: {zones_triggered}/{zones_processed} zones triggered"