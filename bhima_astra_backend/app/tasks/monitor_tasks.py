from app.tasks.celery_app import celery
from app.db.session import SessionLocal
from app.db.models.worker import Worker
from app.db.models.policy_claim import PolicyClaim
import logging

logger = logging.getLogger("bhima.monitor_tasks")


@celery.task
def monitor_task():
    """
    Monitor Task - Trigger all workers for dynamic claim creation.
    Runs every 5 minutes via Celery Beat.
    """
    db = SessionLocal()

    try:
        from app.tasks.trigger_tasks import trigger_task  # Lazy import
        
        workers = db.query(Worker).all()
        logger.info(f"[MONITOR] Found {len(workers)} workers, queuing trigger tasks")

        for w in workers:
            trigger_task.delay(w.worker_id)

        return f"monitor completed: {len(workers)} workers queued"
    
    except Exception as e:
        logger.error(f"[MONITOR] Error: {e}")
        return f"monitor error: {str(e)}"
    
    finally:
        db.close()


@celery.task
def continuous_fraud_monitor_task():
    """
    Continuous Fraud Monitor - Check all pending/held claims automatically.
    Runs every 2 minutes via Celery Beat.
    
    This ensures fraud detection happens continuously for:
    - Claims with fraud_flag = NULL (not yet checked)
    - Claims with payout_status in ['pending', 'on_hold_review']
    - Claims that were just created by triggers
    """
    db = SessionLocal()
    
    try:
        from app.tasks.fraud_tasks import fraud_task  # Lazy import to avoid circular dependency
        
        # Get all claims that need fraud checking
        pending_claims = db.query(PolicyClaim).filter(
            (PolicyClaim.fraud_flag == None) |  # Not yet checked
            (PolicyClaim.payout_status.in_(["pending", "on_hold_review"]))
        ).limit(50).all()  # Process max 50 at a time
        
        if not pending_claims:
            logger.debug("[FRAUD MONITOR] No pending claims to check")
            return {"status": "no_pending_claims", "checked": 0}
        
        logger.info(f"[FRAUD MONITOR] Found {len(pending_claims)} claims, queuing fraud tasks")
        
        queued = 0
        for claim in pending_claims:
            try:
                fraud_task.delay(claim.claim_id)
                queued += 1
            except Exception as e:
                logger.error(f"[FRAUD MONITOR] Failed to queue claim {claim.claim_id}: {e}")
        
        logger.info(f"[FRAUD MONITOR] Queued {queued}/{len(pending_claims)} fraud checks")
        return {"status": "success", "checked": queued, "total": len(pending_claims)}
    
    except Exception as e:
        logger.error(f"[FRAUD MONITOR] Error: {e}")
        return {"status": "error", "error": str(e)}
    
    finally:
        db.close()