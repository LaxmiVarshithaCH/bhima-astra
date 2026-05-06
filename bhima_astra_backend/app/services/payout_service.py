import random
from datetime import datetime

from app.db.models.payout import PayoutTransaction
from app.db.models.policy_claim import PolicyClaim
from app.db.models.worker import Worker
from app.utils.cache_manager import CircuitBreakerCache
from app.services.razorpay_service import get_razorpay_service
from sqlalchemy.orm import Session


def process_payout(db: Session, claim_id: int):
    claim = db.query(PolicyClaim).filter(PolicyClaim.claim_id == claim_id).first()

    if not claim:
        return {"status": "claim_not_found"}

    # 🔴 Only approved claims
    if claim.payout_status != "approved":
        return {"status": "not_eligible_for_payout"}

    worker = db.query(Worker).filter(Worker.worker_id == claim.worker_id).first()

    # ── Circuit breaker: pause payouts if weekly pool > 80% ───────────────
    if CircuitBreakerCache.is_open():
        return {
            "status": "circuit_open",
            "claim_id": claim_id,
            "payout_amount": 0,
            "message": "Payout paused: weekly risk pool limit reached. Admin action required.",
        }

    # 🔥 payout calculation
    payout_amount = claim.income_loss or 0

    # 🔥 Process payment via Razorpay
    razorpay = get_razorpay_service()
    payment_result = razorpay.create_transfer(
        claim_id=claim_id,
        worker_id=worker.worker_id,
        amount=payout_amount,
        worker_upi=worker.upi_id,
        worker_phone=worker.phone_number,
    )

    if payment_result.get("status") != "success":
        return {
            "status": "payout_failed",
            "claim_id": claim_id,
            "error": payment_result.get("error", "Razorpay transfer failed"),
        }

    payment_ref = payment_result.get("payment_reference", f"PAY_{random.randint(100000, 999999)}")

    transaction = PayoutTransaction(
        claim_id=claim.claim_id,
        worker_id=worker.worker_id,
        amount=payout_amount,
        status="success",
        payment_reference=payment_ref,
    )

    db.add(transaction)

    # update claim
    claim.payout_status = "paid"
    claim.payout_timestamp = datetime.utcnow()
    claim.payout_amount = payout_amount

    db.commit()

    # ── Accumulate into weekly pool tracker ───────────────────────────────
    CircuitBreakerCache.add_payout(payout_amount)

    return {
        "claim_id": claim_id,
        "payout_amount": payout_amount,
        "status": "paid",
        "payment_reference": payment_ref,
        "razorpay_mode": payment_result.get("mode", "unknown"),
    }


def get_worker_payouts(db: Session, worker_id: int):
    return (
        db.query(PayoutTransaction)
        .filter(PayoutTransaction.worker_id == worker_id)
        .all()
    )


def get_claim_payout(db: Session, claim_id: int):
    return (
        db.query(PayoutTransaction)
        .filter(PayoutTransaction.claim_id == claim_id)
        .first()
    )
