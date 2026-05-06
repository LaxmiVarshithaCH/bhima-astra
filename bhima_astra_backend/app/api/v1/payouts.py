from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.services.payout_service import (
    process_payout,
    get_worker_payouts,
    get_claim_payout
)
from app.db.models.policy_claim import PolicyClaim

router = APIRouter(prefix="/payouts", tags=["Payouts"])


@router.get("/{worker_id}")
def worker_payouts(worker_id: int, db: Session = Depends(get_db)):
    return get_worker_payouts(db, worker_id)


@router.get("/claim/{claim_id}")
def claim_payout(claim_id: int, db: Session = Depends(get_db)):
    return get_claim_payout(db, claim_id)


@router.post("/retry/{claim_id}")
def retry(claim_id: int, db: Session = Depends(get_db)):
    claim = db.query(PolicyClaim).filter(
        PolicyClaim.claim_id == claim_id
    ).first()

    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")

    return process_payout(db, claim_id)