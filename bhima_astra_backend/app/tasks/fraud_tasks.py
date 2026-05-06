from app.tasks.celery_app import celery
from app.db.session import SessionLocal
from app.services.fraud_service import process_fraud_check
from app.tasks.payout_tasks import payout_task
import logging

logger = logging.getLogger("bhima.fraud_tasks")


@celery.task
def fraud_task(claim_id: int):
    """
    Fraud Detection Celery Task - 4-Stage Cascade Orchestration.
    
    Calls the Fraud Service which orchestrates the complete 4-stage cascade:
    - Stage 1: Deterministic anti-spoofing rules (~0ms)
    - Stage 2: LSTM behavioral analysis (~5ms)
    - Stage 3: Graph community detection for ring fraud (~50ms)
    - Stage 4: Adaptive percentile decisioning with Claude Haiku audit (~500ms)
    
    Real trained models + no static thresholds = production-grade fraud detection.
    """
    logger.info(f"[FRAUD] Processing claim {claim_id} through 4-stage cascade")

    db = SessionLocal()
    
    try:
        result = process_fraud_check(db, claim_id)

        fraud_status = result.get("fraud_flag", False)
        payout_action = result.get("payout_action", "unknown")
        stage_reached = result.get("stage_reached", "unknown")
        fraud_score = result.get("fraud_score", 0)

        logger.info(f"[FRAUD RESULT] claim={claim_id}, fraud_flag={fraud_status}, "
                   f"stage={stage_reached}, score={fraud_score:.3f}, action={payout_action}")

        if payout_action == "release_full" or payout_action == "release_partial":
            logger.info(f"[FRAUD] Claim {claim_id} approved (action={payout_action}) "
                       f"→ routing to Payout Agent")
            payout_task.delay(claim_id)
            
            return {
                "status": "approved",
                "claim_id": claim_id,
                "fraud_score": fraud_score,
                "stage_reached": stage_reached,
                "payout_action": payout_action
            }
        else:
            logger.info(f"[FRAUD] Claim {claim_id} held/blocked (action={payout_action})")
            return {
                "status": "held_or_blocked",
                "claim_id": claim_id,
                "fraud_score": fraud_score,
                "stage_reached": stage_reached,
                "payout_action": payout_action,
                "fraud_reason": result.get("fraud_reason", "Manual review required")
            }

    except Exception as e:
        logger.error(f"[FRAUD] Error processing claim {claim_id}: {e}")
        return {
            "status": "error",
            "claim_id": claim_id,
            "error": str(e)
        }
    
    finally:
        db.close()