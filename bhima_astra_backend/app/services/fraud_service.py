"""
Fraud Detection Service - 4-Stage Cascade

Routes to actual fraud_inference.py which implements:
Stage 1: Deterministic rules
Stage 2: Behavioral LSTM
Stage 3: Graph clustering (Louvain)
Stage 4: Adaptive percentile decisioning
"""

from app.db.models.policy_claim import PolicyClaim
from app.ml.fraud_inference import run_fraud_check as ml_run_fraud_check
from sqlalchemy.orm import Session


def run_fraud_check(db: Session, claim_id: int):
    """
    Run complete 4-stage fraud detection cascade on a claim.

    Uses actual trained models and sophisticated signal processing:
    - XGBoost fraud classifier
    - LSTM behavioral analysis
    - Louvain ring fraud detection
    - Adaptive percentile decisioning

    Returns complete fraud check result with detailed breakdown.
    """
    result = ml_run_fraud_check(db, claim_id)
    return result


def process_fraud_check(db: Session, claim_id: int):
    """
    Alias for run_fraud_check - maintained for backward compatibility.
    """
    return run_fraud_check(db, claim_id)


def get_fraud_claims(
    db: Session, status: str = "flagged", page: int = 1, limit: int = 50
):
    """
    Fetch all fraud claims with specified status (flagged/held).

    Args:
        db: Database session
        status: Filter by status - "flagged" (fraud_flag=True) or "held" (claim_valid_flag=False)
        page: Page number (1-indexed)
        limit: Items per page (max 50)

    Returns:
        Dict with total count, page info, and list of claims
    """
    from app.db.models.worker import Worker

    query = db.query(PolicyClaim).join(
        Worker, Worker.worker_id == PolicyClaim.worker_id
    )

    # Filter by status
    if status == "flagged":
        query = query.filter(PolicyClaim.fraud_flag == True)
    elif status == "held":
        query = query.filter(PolicyClaim.claim_valid_flag == False)

    # Order by timestamp descending
    query = query.order_by(PolicyClaim.claim_timestamp.desc())

    # Get total count
    total = query.count()

    # Apply pagination
    offset = (page - 1) * limit
    claims = query.offset(offset).limit(limit).all()

    return {"total": total, "page": page, "limit": limit, "items": claims}


def get_fraud_claim_detail(db: Session, claim_id: int):
    """
    Fetch detailed fraud claim information including worker profile,
    trigger details, and SHAP explanation if available.

    Args:
        db: Database session
        claim_id: Claim ID

    Returns:
        Detailed claim information or None if not found
    """
    from app.db.models.worker import Worker

    claim = db.query(PolicyClaim).filter(PolicyClaim.claim_id == claim_id).first()

    if not claim:
        return None

    # Get worker details
    worker = db.query(Worker).filter(Worker.worker_id == claim.worker_id).first()

    # Build response with all available details
    return {
        "claim": claim,
        "worker": worker,
        "claim_id": claim.claim_id,
        "worker_id": claim.worker_id,
        "policy_id": claim.policy_id,
        "plan_tier": claim.plan_tier,
        "weekly_premium": claim.weekly_premium,
        "policy_status": claim.policy_status,
        "trigger_type": claim.trigger_type,
        "trigger_level": claim.trigger_level,
        "trigger_value": claim.trigger_value,
        "trigger_evidence": claim.trigger_evidence,
        "fraud_score": claim.fraud_score,
        "fraud_flag": claim.fraud_flag,
        "fraud_reason": claim.fraud_reason,
        "claim_timestamp": claim.claim_timestamp,
        "claim_valid_flag": claim.claim_valid_flag,
        "payout_status": claim.payout_status,
        "payout_amount": claim.payout_amount,
        "payout_timestamp": claim.payout_timestamp,
        "income_loss": claim.income_loss,
        "gps_lat": claim.gps_lat,
        "gps_lng": claim.gps_lng,
        "cell_tower_id": claim.cell_tower_id,
        "gps_tower_delta": claim.gps_tower_delta,
        "accelerometer_variance": claim.accelerometer_variance,
        "claim_response_time_sec": claim.claim_response_time_sec,
        "app_interaction_count": claim.app_interaction_count,
    }


def get_pending_fraud_claims(db: Session):
    """
    Get all pending/held claims that need continuous fraud detection.
    Returns claims that are:
    - New and haven't been fraud checked yet (payout_status = 'pending')
    - On hold waiting for review (payout_status = 'on_hold_review')

    Used by admin fraud detection page for continuous processing.
    """
    from app.db.models.worker import Worker
    from sqlalchemy import and_, or_

    # Get pending and held claims with worker data
    claims = (
        db.query(
            PolicyClaim.claim_id,
            PolicyClaim.worker_id,
            Worker.geo_zone_id,
            PolicyClaim.trigger_type,
            PolicyClaim.trigger_level,
            PolicyClaim.payout_status,
            PolicyClaim.fraud_score,
            PolicyClaim.fraud_flag,
        )
        .join(Worker, Worker.worker_id == PolicyClaim.worker_id)
        .filter(
            or_(
                PolicyClaim.payout_status.in_(["pending", "on_hold_review"]),
                PolicyClaim.fraud_flag == None  # Not yet checked
            )
        )
        .order_by(PolicyClaim.claim_timestamp.desc())
        .limit(50)  # Max 50 at a time for performance
        .all()
    )

    return {
        "items": [
            {
                "claim_id": c.claim_id,
                "worker_id": c.worker_id,
                "zone": c.geo_zone_id or "Unknown",
                "trigger_type": c.trigger_type or "composite",
                "trigger_level": c.trigger_level or "L2",
                "payout_status": c.payout_status or "pending",
                "fraud_score": c.fraud_score or 0.0,
                "fraud_flag": c.fraud_flag or False,
            }
            for c in claims
        ],
        "total": len(claims),
    }
