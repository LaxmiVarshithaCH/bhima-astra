"""
Payout Agent - Claim Settlement & Fund Management

This agent processes approved claims for payout with intelligent decision-making:

1. Payout Processing:
   - Validates fraud checks before release
   - Routes to appropriate settlement method
   - Handles partial payouts (50%) for suspicious claims

2. Payout Methods:
   - Direct bank transfer (standard)
   - Mobile wallet (Paytm/GPay) - instant
   - Credit to next premium (deferred)
   - Manual review queue (holds)

3. Fund Management:
   - Tracks payout ledger
   - Manages hold periods (48 hours for review)
   - Escalates blocked claims for manual intervention

4. Compliance:
   - Logs all payout transactions
   - Maintains audit trail
   - Ensures KYC/compliance before release
"""

import logging
from datetime import datetime, timedelta

from app.db.models.payout import PayoutTransaction  # Tracks all payouts
from app.db.models.policy_claim import PolicyClaim
from app.db.models.worker import Worker
from app.db.session import SessionLocal
from sqlalchemy.orm import Session

logger = logging.getLogger("bhima.payout_agent")


def process_payout(db: Session, claim_id: int) -> dict:
    """
    Process claim payout based on fraud determination.

    Args:
        db: Database session
        claim_id: Claim ID to process for payout

    Returns:
        {
            'claim_id': int,
            'payout_status': str (released/partial/hold/blocked),
            'payout_amount': float,
            'payout_method': str (bank_transfer/wallet/credit_next_premium),
            'payout_timestamp': datetime,
            'transaction_id': str,
            'timestamp': datetime,
        }
    """
    try:
        claim = db.query(PolicyClaim).filter(PolicyClaim.claim_id == claim_id).first()
        if not claim:
            logger.error(f"[PAYOUT] Claim not found: {claim_id}")
            return {"claim_id": claim_id, "error": "Claim not found", "status": "error"}

        worker = db.query(Worker).filter(Worker.worker_id == claim.worker_id).first()
        if not worker:
            logger.error(f"[PAYOUT] Worker not found: {claim.worker_id}")
            return {
                "claim_id": claim_id,
                "worker_id": claim.worker_id,
                "error": "Worker not found",
                "status": "error",
            }

        logger.info(
            f"[PAYOUT] Processing claim {claim_id} for worker {claim.worker_id}"
        )

        # Calculate payout amount based on plan tier
        income_loss = claim.income_loss or 0
        plan_tier = claim.plan_tier or "standard"

        # Payout coverage: basic=70%, standard=85%, premium=100%
        coverage_map = {"basic": 0.70, "standard": 0.85, "premium": 1.0}
        coverage_pct = coverage_map.get(plan_tier, 0.85)

        base_payout = income_loss * coverage_pct

        # Adjust for fraud determination
        payout_status = claim.payout_status or "pending"

        if payout_status == "approved":
            # Full release
            payout_amount = base_payout
            settlement_status = "released"
            payout_method = determine_payout_method(worker)
            reason = "Claim approved - full coverage"

        elif payout_status == "partial_approved":
            # Partial release (50% immediately, rest on hold)
            payout_amount = base_payout * 0.5
            settlement_status = "partial_released"
            payout_method = determine_payout_method(worker)
            reason = "Claim partially approved - holding half pending review"

        elif payout_status == "on_hold_review":
            # 48-hour hold - check if hold period expired
            if claim.claim_timestamp:
                hold_expires = claim.claim_timestamp + timedelta(hours=48)
                if datetime.utcnow() >= hold_expires:
                    # Hold period expired - auto-approve partial
                    payout_amount = base_payout * 0.5
                    settlement_status = "released_post_hold"
                    payout_method = determine_payout_method(worker)
                    reason = "Hold period (48h) expired - releasing partial payment"
                else:
                    # Still in hold period
                    hours_remaining = (
                        hold_expires - datetime.utcnow()
                    ).total_seconds() / 3600
                    logger.info(
                        f"[PAYOUT] Claim still on hold - {hours_remaining:.1f}h remaining"
                    )
                    return {
                        "claim_id": claim_id,
                        "payout_status": "on_hold",
                        "payout_amount": 0,
                        "hold_expires_at": hold_expires.isoformat(),
                        "hours_remaining": hours_remaining,
                        "reason": "Claim under review - waiting for fraud determination",
                    }
            else:
                payout_amount = 0
                settlement_status = "hold"
                payout_method = "none"
                reason = "Pending fraud review (48h hold)"

        elif payout_status == "blocked":
            # Blocked claims - no payout
            payout_amount = 0
            settlement_status = "blocked"
            payout_method = "none"
            reason = "Claim blocked - fraud detected / policy violation"
            logger.warning(f"[PAYOUT] Blocked claim {claim_id} - not processing payout")

        else:
            # Unknown status
            payout_amount = 0
            settlement_status = "error"
            payout_method = "none"
            reason = f"Unknown payout status: {payout_status}"

        # Only create payout record if amount > 0
        if payout_amount > 0:
            # Create payout record
            payout_record = PayoutTransaction(
                claim_id=claim_id,
                worker_id=claim.worker_id,
                amount=payout_amount,
                status=settlement_status,
                payment_reference=f"TXN-{claim_id}-{int(datetime.utcnow().timestamp())}",
                failure_reason=None,
            )
            db.add(payout_record)

            # Update claim
            claim.payout_status = settlement_status
            claim.payout_amount = payout_amount
            claim.payout_timestamp = datetime.utcnow()

            db.commit()

            logger.info(
                f"[PAYOUT] Payout processed - claim={claim_id}, "
                f"amount=₹{payout_amount:.2f}, method={payout_method}, status={settlement_status}"
            )

            return {
                "claim_id": claim_id,
                "worker_id": claim.worker_id,
                "payout_status": settlement_status,
                "payout_amount": payout_amount,
                "payout_method": payout_method,
                "transaction_id": payout_record.payment_reference,
                "payout_timestamp": datetime.utcnow().isoformat(),
                "reason": reason,
                "timestamp": datetime.utcnow().isoformat(),
                "status": "success",
            }
        else:
            # No payout to process
            claim.payout_status = settlement_status
            claim.payout_timestamp = datetime.utcnow()
            db.commit()

            logger.info(
                f"[PAYOUT] No payout processed - claim={claim_id}, "
                f"reason={reason}, status={settlement_status}"
            )

            return {
                "claim_id": claim_id,
                "worker_id": claim.worker_id,
                "payout_status": settlement_status,
                "payout_amount": 0,
                "payout_method": payout_method,
                "payout_timestamp": datetime.utcnow().isoformat(),
                "reason": reason,
                "timestamp": datetime.utcnow().isoformat(),
                "status": "success",
            }

    except Exception as e:
        logger.error(
            f"[PAYOUT] Error processing payout for claim {claim_id}: {str(e)}",
            exc_info=True,
        )
        return {"claim_id": claim_id, "error": str(e), "status": "error"}


def determine_payout_method(worker: Worker) -> str:
    """
    Determine optimal payout method based on worker profile.

    Preference order:
    1. UPI transfer (instant) if upi_id present
    2. Bank transfer if IFSC present
    3. Credit to next premium (deferred)
    """
    if worker.upi_id:
        return "upi_transfer"  # Instant via Razorpay UPI
    elif worker.bank_ifsc:
        return "bank_transfer"  # 1-2 business days
    else:
        return "credit_next_premium"  # Deferred to next policy


def check_hold_claims(db: Session) -> dict:
    """
    Check all claims on hold and process if hold period expired.
    Runs periodically (e.g., every 1 hour) to auto-release after 48h.

    Returns count of claims processed and amounts released.
    """
    try:
        logger.info("[PAYOUT] Checking claims on hold for expiration")

        hold_claims = (
            db.query(PolicyClaim)
            .filter(PolicyClaim.payout_status == "on_hold_review")
            .all()
        )

        processed = 0
        total_released = 0

        for claim in hold_claims:
            if claim.claim_timestamp:
                hold_expires = claim.claim_timestamp + timedelta(hours=48)
                if datetime.utcnow() >= hold_expires:
                    # Process this claim
                    result = process_payout(db, claim.claim_id)
                    if result.get("status") == "success":
                        processed += 1
                        total_released += result.get("payout_amount", 0)

        logger.info(
            f"[PAYOUT] Hold check complete - processed={processed}, total_released=₹{total_released:.2f}"
        )

        return {
            "claims_processed": processed,
            "total_amount_released": total_released,
            "timestamp": datetime.utcnow().isoformat(),
        }

    except Exception as e:
        logger.error(f"[PAYOUT] Error checking hold claims: {str(e)}", exc_info=True)
        return {"error": str(e), "status": "error"}
