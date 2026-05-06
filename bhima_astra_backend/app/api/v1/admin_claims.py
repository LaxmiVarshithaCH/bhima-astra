from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.db.session import get_db
from app.services.admin_claims_service import *
from app.services.fraud_service import get_pending_fraud_claims
from app.schemas.admin_claims import *

router = APIRouter(prefix="/api/v1/admin", tags=["Admin Claims"])


# 🔍 ALL CLAIMS
@router.get("/claims", response_model=List[ClaimResponse])
def fetch_claims(db: Session = Depends(get_db)):
    return get_all_claims(db)


# 🔍 CLAIM DETAIL
@router.get("/claims/{claim_id}", response_model=ClaimDetailResponse)
def fetch_claim_detail(claim_id: int, db: Session = Depends(get_db)):
    data = get_claim_detail(db, claim_id)
    if not data:
        raise HTTPException(status_code=404, detail="Claim not found")
    return data


# ✅ APPROVE
@router.post("/claims/{claim_id}/approve", response_model=ActionResponse)
def approve(claim_id: int, db: Session = Depends(get_db)):
    return approve_claim(db, claim_id)


# ❌ REJECT
@router.post("/claims/{claim_id}/reject", response_model=ActionResponse)
def reject(claim_id: int, db: Session = Depends(get_db)):
    return reject_claim(db, claim_id)


# 💰 PENDING PAYOUTS
@router.get("/payouts/pending")
def pending_payouts(db: Session = Depends(get_db)):
    return get_pending_payouts(db)


# 💸 RELEASE PAYOUT
@router.post("/payouts/{claim_id}/release", response_model=ActionResponse)
async def release(claim_id: int, db: Session = Depends(get_db)):
    return release_payout(db, claim_id)


# 🚨 PENDING FRAUD CLAIMS FOR CONTINUOUS DETECTION
@router.get("/fraud/pending")
def pending_fraud(db: Session = Depends(get_db)):
    """Get all pending/held fraud claims for continuous detection."""
    return get_pending_fraud_claims(db)


# 🚀 TRIGGER FRAUD CHECKS ON ALL PENDING CLAIMS
@router.post("/fraud/check-pending")
def trigger_pending_fraud_checks(db: Session = Depends(get_db)):
    """
    Trigger fraud detection on all pending/held claims.
    Queues Celery tasks for each pending claim for continuous processing.
    """
    # Lazy import to avoid circular dependency
    from app.tasks.fraud_tasks import fraud_task
    
    pending_claims = get_pending_fraud_claims(db)
    
    if not pending_claims.get("items"):
        return {
            "status": "no_pending_claims",
            "total_queued": 0,
            "message": "No pending claims to process"
        }
    
    queued_tasks = []
    for claim in pending_claims.get("items", []):
        try:
            task = fraud_task.delay(claim["claim_id"])
            queued_tasks.append({
                "claim_id": claim["claim_id"],
                "task_id": task.id,
                "status": "queued"
            })
        except Exception as e:
            queued_tasks.append({
                "claim_id": claim["claim_id"],
                "status": "error",
                "error": str(e)
            })
    
    return {
        "status": "fraud_checks_queued",
        "total_pending": pending_claims.get("total", 0),
        "total_queued": len([t for t in queued_tasks if t.get("status") == "queued"]),
        "queued_tasks": queued_tasks
    }


# 💳 RAZORPAY PAYOUT STATS
@router.get("/razorpay/payout-stats")
def razorpay_payout_stats(db: Session = Depends(get_db)):
    """Get Razorpay payout statistics and recent transactions from database."""
    from app.services.admin_claims_service import get_razorpay_payout_stats
    return get_razorpay_payout_stats(db)