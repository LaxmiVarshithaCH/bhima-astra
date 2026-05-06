from app.tasks.celery_app import celery
from app.db.session import SessionLocal
from app.db.models.worker import Worker
from app.services.zone_service import compute_zone_live_data
from app.utils.redis_client import redis_client
import json
import logging

logger = logging.getLogger("bhima.zone_tasks")


@celery.task
def refresh_zone_cache():
    """
    Refresh zone-level cache with ML-based risk computations.
    
    Computes zone disruption probability using XGBoost predictions for each zone,
    updates Redis cache with ML scores instead of mock averages.
    
    Called periodically (every 15 minutes) to keep zone risk data current.
    """
    db = SessionLocal()
    
    try:
        logger.info("[ZONE CACHE] Starting zone cache refresh with ML models...")
        
        zones = db.query(Worker.geo_zone_id).distinct().all()
        zones_updated = 0

        for z in zones:
            zone_id = z[0]
            
            if not zone_id:
                continue
            
            try:
                # 🔥 Compute zone live data using ML risk inference
                data = compute_zone_live_data(db, zone_id)

                # 🔥 Store in Redis (TTL = 300 sec = 5 minutes)
                redis_client.setex(
                    f"zone_live:{zone_id}",
                    300,
                    json.dumps(data)
                )
                
                zones_updated += 1
                
                logger.debug(f"[ZONE CACHE] Updated {zone_id} - "
                           f"disruption_prob={data.get('disruption_probability', 0):.3f}, "
                           f"zone_risk={data.get('zone_risk_score', 0):.3f}, "
                           f"trigger={data.get('trigger_recommended', False)}")

            except Exception as e:
                logger.error(f"[ZONE CACHE] Failed to update zone {zone_id}: {e}")
                continue

        logger.info(f"[ZONE CACHE] Zone cache refresh complete: {zones_updated} zones updated")
        
        return f"zone cache refreshed: {zones_updated} zones updated"

    finally:
        db.close()