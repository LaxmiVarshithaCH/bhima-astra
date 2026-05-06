from app.tasks.celery_app import celery
from app.db.session import SessionLocal
from app.services.payout_service import process_payout
import logging

logger = logging.getLogger("bhima.payout_tasks")


@celery.task
def payout_task(claim_id: int):
    """
    Payout Execution Celery Task - Final Stage of ML Pipeline.
    
    Executes the payout for claims approved by the Fraud Agent.
    Simulates UPI disbursement via Razorpay sandbox with full audit trail.
    
    By this point, claim has passed:
    - XGBoost disruption trigger (Trigger Agent)
    - 4-stage fraud cascade (Fraud Agent)
    
    Only clean, approved claims reach this task.
    """
    logger.info(f"[PAYOUT] Processing claim {claim_id} → disbursement via UPI/Razorpay")

    db = SessionLocal()
    
    try:
        result = process_payout(db, claim_id)

        payout_amount = result.get("payout_amount", 0)
        status = result.get("status", "unknown")

        if status == "paid":
            logger.info(f"[PAYOUT SUCCESS] claim={claim_id}, amount=₹{payout_amount}, "
                       f"reference={result.get('payment_reference', 'N/A')}")
        else:
            logger.warning(f"[PAYOUT FAILED] claim={claim_id}, status={status}")

        return {
            "status": status,
            "claim_id": claim_id,
            "payout_amount": payout_amount,
            "payment_reference": result.get("payment_reference", "N/A"),
            "timestamp": result.get("payout_timestamp", "N/A")
        }

    except Exception as e:
        logger.error(f"[PAYOUT] Error processing claim {claim_id}: {e}")
        
        return {
            "status": "error",
            "claim_id": claim_id,
            "error": str(e)
        }
    
    finally:
        db.close()