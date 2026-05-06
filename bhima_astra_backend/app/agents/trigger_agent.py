"""
Trigger Agent - Disruption Event Detection & Claim Initiation

This agent evaluates workers for claim eligibility when disruption events occur:

1. Event Detection:
   - Monitors daily operations for disruption flags
   - Uses ML risk_inference to compute disruption probability
   - Triggers claims when probability > threshold

2. Claim Eligibility:
   - Validates active policy exists
   - Checks events remaining
   - Ensures worker premium current

3. Claim Creation:
   - Auto-creates PolicyClaim records
   - Enriches with ML disruption scores
   - Routes to fraud detection pipeline

Triggered by monitor_task every 5 minutes via Celery Beat.
"""

import logging
from datetime import datetime
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.db.models.worker import Worker
from app.db.models.policy_claim import PolicyClaim
from app.db.models.daily_operations import DailyOperation
from app.ml.risk_inference import compute_risk_score
from app.services.trigger_service import evaluate_and_trigger

logger = logging.getLogger("bhima.trigger_agent")


def evaluate_worker_for_trigger(db: Session, worker_id: int) -> dict:
    """
    Evaluate if worker should have claim triggered based on disruption.
    
    Flow:
    1. Get latest DailyOperation for worker
    2. Compute ML disruption risk score
    3. Compare vs threshold (0.5)
    4. If exceeded, create and trigger claim
    5. Queue for fraud check
    
    Args:
        db: Database session
        worker_id: Worker to evaluate
        
    Returns:
        {
            'worker_id': int,
            'evaluation_status': str (triggered/not_triggered/error),
            'disruption_probability': float,
            'reason': str,
            'claim_id': int (if triggered),
            'timestamp': datetime,
        }
    """
    try:
        logger.info(f"[TRIGGER] Evaluating worker {worker_id} for claim trigger")
        
        # Get latest operation
        latest_op = (
            db.query(DailyOperation)
            .filter(DailyOperation.worker_id == worker_id)
            .order_by(DailyOperation.date.desc())
            .first()
        )
        
        if not latest_op:
            logger.debug(f"[TRIGGER] No recent operations for worker {worker_id}")
            return {
                "worker_id": worker_id,
                "evaluation_status": "no_data",
                "reason": "No recent operations found",
                "timestamp": datetime.utcnow().isoformat(),
            }
        
        # Get ML disruption score
        try:
            risk_data = compute_risk_score(db, worker_id)
            disruption_prob = risk_data.get("combined_disruption_probability", 0)
        except Exception as e:
            logger.warning(f"[TRIGGER] Could not compute risk score for worker {worker_id}: {e}")
            disruption_prob = 1.0 if latest_op.disruption_flag else 0.0
        
        logger.info(f"[TRIGGER] Worker {worker_id} - disruption_prob={disruption_prob:.3f}")
        
        # Route to trigger evaluation service
        trigger_result = evaluate_and_trigger(db, worker_id)
        
        if trigger_result.get("status") == "claim_created":
            claim_id = trigger_result.get("claim_id")
            logger.info(f"[TRIGGER] Claim created for worker {worker_id} - claim_id={claim_id}, "
                       f"disruption_prob={disruption_prob:.3f}")
            
            return {
                "worker_id": worker_id,
                "evaluation_status": "triggered",
                "claim_id": claim_id,
                "disruption_probability": disruption_prob,
                "reason": trigger_result.get("status"),
                "income_loss": trigger_result.get("income_loss"),
                "timestamp": datetime.utcnow().isoformat(),
            }
        elif trigger_result.get("status") == "limit_exceeded":
            logger.info(f"[TRIGGER] Trigger blocked for worker {worker_id} - event limit exceeded")
            return {
                "worker_id": worker_id,
                "evaluation_status": "not_triggered",
                "reason": "Event limit exceeded",
                "timestamp": datetime.utcnow().isoformat(),
            }
        elif trigger_result.get("status") == "no_policy":
            logger.info(f"[TRIGGER] Trigger blocked for worker {worker_id} - no active policy")
            return {
                "worker_id": worker_id,
                "evaluation_status": "not_triggered",
                "reason": "No active policy",
                "timestamp": datetime.utcnow().isoformat(),
            }
        else:
            # Doesn't pass threshold
            reason = trigger_result.get("status", "Disruption threshold not exceeded")
            logger.debug(f"[TRIGGER] No trigger for worker {worker_id} - {reason}")
            return {
                "worker_id": worker_id,
                "evaluation_status": "not_triggered",
                "disruption_probability": disruption_prob,
                "reason": reason,
                "timestamp": datetime.utcnow().isoformat(),
            }
        
    except Exception as e:
        logger.error(f"[TRIGGER] Error evaluating worker {worker_id}: {str(e)}", exc_info=True)
        return {
            "worker_id": worker_id,
            "evaluation_status": "error",
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat(),
        }


def batch_evaluate_workers(db: Session, limit: int = 100) -> dict:
    """
    Batch evaluate all active workers for claim triggers.
    
    Runs periodically to sweep through all workers checking for disruption events.
    Useful as fallback when individual trigger monitoring fails.
    
    Args:
        db: Database session
        limit: Max workers to process per batch
        
    Returns:
        {
            'total_workers_evaluated': int,
            'claims_triggered': int,
            'evaluation_errors': int,
            'timestamp': datetime,
        }
    """
    try:
        logger.info(f"[TRIGGER] Starting batch evaluation of up to {limit} workers")
        
        # Get all active workers (limit for performance)
        active_workers = (
            db.query(Worker)
            .limit(limit)
            .all()
        )
        
        total_evaluated = 0
        claims_triggered = 0
        errors = 0
        
        for worker in active_workers:
            result = evaluate_worker_for_trigger(db, worker.worker_id)
            total_evaluated += 1
            
            if result.get("evaluation_status") == "triggered":
                claims_triggered += 1
            elif result.get("evaluation_status") == "error":
                errors += 1
        
        logger.info(f"[TRIGGER] Batch evaluation complete - "
                   f"evaluated={total_evaluated}, triggered={claims_triggered}, errors={errors}")
        
        return {
            "total_workers_evaluated": total_evaluated,
            "claims_triggered": claims_triggered,
            "evaluation_errors": errors,
            "timestamp": datetime.utcnow().isoformat(),
        }
        
    except Exception as e:
        logger.error(f"[TRIGGER] Error in batch evaluation: {str(e)}", exc_info=True)
        return {
            "error": str(e),
            "status": "error"
        }


def get_trigger_statistics(db: Session, days: int = 7) -> dict:
    """
    Get trigger statistics for the past N days.
    
    Returns metrics on claim creation patterns, trigger success rate, etc.
    Useful for monitoring system health and disruption frequency.
    
    Args:
        db: Database session
        days: Number of days to analyze
        
    Returns:
        {
            'period_days': int,
            'total_claims_triggered': int,
            'total_workers_evaluated': int,  (estimated from claims)
            'avg_daily_triggers': float,
            'claim_to_payout_rate': float (approved claims / total claims),
            'fraud_detection_rate': float (fraudulent / total),
            'timestamp': datetime,
        }
    """
    try:
        from datetime import timedelta
        
        start_date = datetime.utcnow() - timedelta(days=days)
        
        # Get claims created in period
        claims_in_period = (
            db.query(PolicyClaim)
            .filter(PolicyClaim.claim_timestamp >= start_date)
            .all()
        )
        
        total_claims = len(claims_in_period)
        approved_claims = len([c for c in claims_in_period if c.payout_status == "approved"])
        fraud_claims = len([c for c in claims_in_period if c.fraud_flag])
        
        avg_daily_triggers = total_claims / days if days > 0 else 0
        claim_to_payout_rate = (approved_claims / total_claims * 100) if total_claims > 0 else 0
        fraud_detection_rate = (fraud_claims / total_claims * 100) if total_claims > 0 else 0
        
        logger.info(f"[TRIGGER] Statistics computed - period={days}d, "
                   f"total_claims={total_claims}, fraud_rate={fraud_detection_rate:.1f}%")
        
        return {
            "period_days": days,
            "total_claims_triggered": total_claims,
            "total_unique_workers": len(set(c.worker_id for c in claims_in_period)) if claims_in_period else 0,
            "avg_daily_triggers": avg_daily_triggers,
            "claims_approved": approved_claims,
            "claims_fraud_detected": fraud_claims,
            "claim_to_payout_rate_pct": claim_to_payout_rate,
            "fraud_detection_rate_pct": fraud_detection_rate,
            "timestamp": datetime.utcnow().isoformat(),
        }
        
    except Exception as e:
        logger.error(f"[TRIGGER] Error computing statistics: {str(e)}", exc_info=True)
        return {
            "error": str(e),
            "status": "error"
        }
