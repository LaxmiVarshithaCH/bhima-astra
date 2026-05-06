from app.tasks.celery_app import celery
from app.db.session import SessionLocal
from app.services.trigger_service import evaluate_and_trigger
from app.tasks.fraud_tasks import fraud_task
import logging

logger = logging.getLogger("bhima.trigger_tasks")


@celery.task
def trigger_task(worker_id: int):
    """
    Trigger Celery Task - Evaluate worker against ML disruption model.
    
    Calls the Trigger Service which uses XGBoost risk_model.pkl to predict
    if a worker should have a claim triggered based on current zone conditions.
    
    No mock thresholds - all decisions driven by ML model predictions.
    """
    logger.info(f"[TRIGGER] Processing worker {worker_id} via ML trigger service")

    db = SessionLocal()
    
    try:
        result = evaluate_and_trigger(db, worker_id)

        logger.info(f"[TRIGGER RESULT] worker={worker_id}, status={result.get('status')}, "
                   f"disruption_prob={result.get('disruption_probability', 'N/A')}")

        if result.get("status") == "claim_created":
            claim_id = result["claim_id"]
            logger.info(f"[TRIGGER] Claim created (claim_id={claim_id}) → routing to Fraud Agent")
            fraud_task.delay(claim_id)
            
            return {
                "status": "claim_created",
                "worker_id": worker_id,
                "claim_id": claim_id,
                "income_loss": result.get("income_loss", 0),
                "disruption_prob": result.get("disruption_probability", 0)
            }
        else:
            logger.debug(f"[TRIGGER] No trigger for worker {worker_id}: {result.get('status')}")
            return result

    except Exception as e:
        logger.error(f"[TRIGGER] Error processing worker {worker_id}: {e}")
        return {
            "status": "error",
            "worker_id": worker_id,
            "error": str(e)
        }
    
    finally:
        db.close()