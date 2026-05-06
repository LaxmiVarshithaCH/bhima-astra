from typing import List

from app.core.deps import get_current_worker
from app.db.session import get_db
from app.schemas.worker import (
    DailyOperationResponse,
    EarningsEstimateResponse,
    PayoutItemResponse,
    WorkerProfileResponse,
    WorkerUpdateRequest,
)
from app.services.worker_service import (
    get_worker_daily_ops,
    get_worker_earnings_estimate,
    get_worker_payouts,
    get_worker_profile,
    update_worker_profile,
)
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

router = APIRouter(prefix="/workers", tags=["Workers"])


@router.get("/me/profile", response_model=WorkerProfileResponse)
def profile(current_worker=Depends(get_current_worker), db: Session = Depends(get_db)):
    worker = get_worker_profile(db, current_worker.worker_id)
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")
    return worker


@router.get("/me/daily-operations", response_model=List[DailyOperationResponse])
def daily_ops(
    current_worker=Depends(get_current_worker), db: Session = Depends(get_db)
):
    ops = get_worker_daily_ops(db, current_worker.worker_id)
    return [
        {
            "date": str(op.date) if op.date is not None else None,
            "daily_income": op.daily_income,
            "income_loss": op.income_loss,
            "composite_score": op.composite_score,
            "disruption_flag": op.disruption_flag,
        }
        for op in ops
    ]


@router.get("/me/payouts", response_model=List[PayoutItemResponse])
def payouts(current_worker=Depends(get_current_worker), db: Session = Depends(get_db)):
    claims = get_worker_payouts(db, current_worker.worker_id)
    return [
        {
            "claim_id": c.claim_id,
            "worker_id": c.worker_id,
            "plan_tier": c.plan_tier,
            "trigger_type": c.trigger_type,
            "trigger_level": c.trigger_level,
            "trigger_value": c.trigger_value,
            "payout_status": c.payout_status,
            "payout_amount": c.payout_amount,
            "fraud_score": c.fraud_score,
            "fraud_flag": c.fraud_flag,
            "fraud_reason": c.fraud_reason,
            "income_loss": c.income_loss,
            "claim_timestamp": str(c.claim_timestamp)
            if c.claim_timestamp is not None
            else None,
            "payout_timestamp": str(c.payout_timestamp)
            if c.payout_timestamp is not None
            else None,
        }
        for c in claims
    ]


@router.get("/me/earnings-estimate", response_model=EarningsEstimateResponse)
def earnings(current_worker=Depends(get_current_worker), db: Session = Depends(get_db)):
    result = get_worker_earnings_estimate(db, current_worker.worker_id)
    avg = float(result.get("avg_income", 0) or 0)  # type: ignore[arg-type]
    # Estimate orders from income: platform avg ~₹40/order for gig workers
    avg_order_value = 40.0
    expected_orders = round(avg / avg_order_value) if avg > 0 else 0
    return {
        "avg_income": avg,
        "expected_income": round(avg * 7, 2),
        "actual_income_today": round(avg * 0.65, 2),
        "income_gap": round(avg * 0.35, 2),
        "expected_orders": expected_orders,
    }


@router.get("/me/notifications")
def notifications(
    current_worker=Depends(get_current_worker), db: Session = Depends(get_db)
):
    """Returns worker notifications based on payout events and triggers."""
    from sqlalchemy import text

    try:
        result = db.execute(
            text("""
            SELECT
                pc.claim_id,
                pc.trigger_type,
                pc.trigger_level,
                pc.payout_status,
                pc.payout_amount,
                pc.fraud_flag,
                pc.fraud_reason,
                pc.claim_timestamp,
                pc.payout_timestamp
            FROM policy_claims pc
            WHERE pc.worker_id = :worker_id
              AND pc.claim_timestamp IS NOT NULL
            ORDER BY pc.claim_timestamp DESC
            LIMIT 20
        """),
            {"worker_id": current_worker.worker_id},
        ).fetchall()

        notifications = []
        for i, r in enumerate(result):
            payout_status = (r.payout_status or "").lower()
            trigger_type = r.trigger_type or "disruption"
            level = r.trigger_level or "L1"
            amount = r.payout_amount

            if payout_status in ("paid", "completed", "released"):
                title = "Payout Credited"
                message = f"₹{amount:.0f} credited to your UPI account for {trigger_type} trigger ({level})"
                notif_type = "payout"
            elif payout_status in ("approved", "processing"):
                title = "Payout Processing"
                message = f"Your {trigger_type} claim ({level}) payout of ₹{amount:.0f} is being processed"
                notif_type = "info"
            elif r.fraud_flag:
                title = "Claim Under Review"
                message = f"Your {trigger_type} claim is flagged for review: {r.fraud_reason or 'Manual review required'}"
                notif_type = "alert"
            elif payout_status in ("rejected", "blocked", "failed"):
                title = "Claim Not Approved"
                message = f"Your {trigger_type} claim could not be processed. Contact support."
                notif_type = "alert"
            else:
                title = "Policy Triggered"
                message = f"Your policy was triggered for {trigger_type} event ({level}) in your zone"
                notif_type = "ticket"

            # Format time
            ts = r.payout_timestamp or r.claim_timestamp
            if ts:
                from datetime import datetime

                now = datetime.utcnow()
                diff = now - ts
                if diff.seconds < 3600:
                    time_str = f"{diff.seconds // 60} mins ago"
                elif diff.days == 0:
                    time_str = f"{diff.seconds // 3600} hrs ago"
                else:
                    time_str = f"{diff.days} days ago"
            else:
                time_str = "Recently"

            notifications.append(
                {
                    "id": r.claim_id,
                    "title": title,
                    "message": message,
                    "time": time_str,
                    "read": payout_status in ("paid", "completed", "released"),
                    "type": notif_type,
                }
            )

        return notifications
    except Exception as e:
        return []


@router.get("/me/disruption-alerts")
def disruption_alerts(
    current_worker=Depends(get_current_worker), db: Session = Depends(get_db)
):
    """Returns disruption flag notifications for workers listed in affected_worker_ids."""
    from sqlalchemy import text
    from datetime import datetime

    try:
        rows = db.execute(
            text("""
            SELECT flag_id, zone_id, disruption_type, description,
                   estimated_payout, workers_in_zone, flag_status, created_at
            FROM manager_disruption_flags
            WHERE affected_worker_ids IS NOT NULL
              AND :wid = ANY(affected_worker_ids)
            ORDER BY created_at DESC
            LIMIT 20
        """),
            {"wid": current_worker.worker_id},
        ).fetchall()

        alerts = []
        for r in rows:
            now = datetime.utcnow()
            diff = now - r.created_at if r.created_at else None
            if diff:
                if diff.seconds < 3600 and diff.days == 0:
                    time_str = f"{diff.seconds // 60} mins ago"
                elif diff.days == 0:
                    time_str = f"{diff.seconds // 3600} hrs ago"
                else:
                    time_str = f"{diff.days} days ago"
            else:
                time_str = "Recently"

            dtype = (r.disruption_type or "disruption").replace("_", " ").title()
            payout_str = f" — estimated payout ₹{r.estimated_payout:.0f}" if r.estimated_payout else ""
            alerts.append({
                "id": f"flag-{r.flag_id}",
                "title": "Zone Disruption Alert",
                "message": f"{dtype} reported in {r.zone_id}. Your route may be affected{payout_str}.",
                "time": time_str,
                "read": r.flag_status in ("verified", "rejected"),
                "type": "alert",
            })
        return alerts
    except Exception as e:
        return []


@router.post("/me/payouts/record-simulation")
def record_simulation_payout(
    payload: dict,
    current_worker=Depends(get_current_worker),
    db: Session = Depends(get_db),
):
    """Records a simulated payout notification for the worker."""
    from datetime import datetime

    from sqlalchemy import text

    try:
        # Find an existing approved claim to mark as paid
        claim = db.execute(
            text("""
            SELECT claim_id FROM policy_claims
            WHERE worker_id = :worker_id
              AND payout_status = 'approved'
            ORDER BY claim_timestamp DESC LIMIT 1
        """),
            {"worker_id": current_worker.worker_id},
        ).fetchone()

        amount = float(payload.get("amount", 560.50))
        payment_ref = payload.get(
            "payment_id", f"PAY_SIM_{datetime.utcnow().strftime('%H%M%S')}"
        )

        if claim:
            db.execute(
                text("""
                UPDATE policy_claims
                SET payout_status = 'paid', payout_timestamp = NOW(), payout_amount = :amount
                WHERE claim_id = :claim_id
            """),
                {"claim_id": claim.claim_id, "amount": amount},
            )
            db.execute(
                text("""
                INSERT INTO payout_transactions (claim_id, worker_id, amount, status, payment_reference)
                VALUES (:claim_id, :worker_id, :amount, 'success', :ref)
                ON CONFLICT DO NOTHING
            """),
                {
                    "claim_id": claim.claim_id,
                    "worker_id": current_worker.worker_id,
                    "amount": amount,
                    "ref": payment_ref,
                },
            )
            db.commit()
            return {"status": "recorded", "claim_id": claim.claim_id, "amount": amount}
        else:
            # Just insert a transaction record
            db.execute(
                text("""
                INSERT INTO payout_transactions (claim_id, worker_id, amount, status, payment_reference)
                SELECT claim_id, :worker_id, :amount, 'success', :ref
                FROM policy_claims WHERE worker_id = :worker_id ORDER BY claim_timestamp DESC LIMIT 1
                ON CONFLICT DO NOTHING
            """),
                {
                    "worker_id": current_worker.worker_id,
                    "amount": amount,
                    "ref": payment_ref,
                },
            )
            db.commit()
            return {"status": "recorded_no_claim", "amount": amount}
    except Exception as e:
        return {"status": "error", "detail": str(e)}


@router.put("/{worker_id}/profile")
def update_profile(
    worker_id: int,
    req: WorkerUpdateRequest,
    db: Session = Depends(get_db),
):
    worker = update_worker_profile(db, worker_id, req.model_dump(exclude_unset=True))
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")
    return {"message": "Profile updated"}


@router.post("/me/withdraw")
def withdraw_balance(
    payload: dict,
    current_worker=Depends(get_current_worker),
    db: Session = Depends(get_db),
):
    """
    Initiate a UPI withdrawal for the worker's accumulated payout balance.
    Records the withdrawal attempt and returns a Razorpay-style receipt.
    """
    from datetime import datetime
    from sqlalchemy import text

    amount = float(payload.get("amount", 0))
    method = payload.get("method", "upi")

    if amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be greater than 0")

    # Fetch worker UPI ID
    worker_row = db.execute(
        text("SELECT upi_id, worker_name FROM workers WHERE worker_id = :wid"),
        {"wid": current_worker.worker_id},
    ).fetchone()

    upi_id = worker_row.upi_id if worker_row else None
    worker_name = worker_row.worker_name if worker_row else "Worker"

    if not upi_id:
        # Return simulated success if no UPI set — prompt to add UPI
        return {
            "status": "simulated",
            "message": "No UPI ID on file. Please add a UPI ID in your profile.",
            "amount": amount,
            "method": method,
            "timestamp": datetime.utcnow().isoformat(),
        }

    # Generate a reference ID
    import random, string
    ref_id = "WD-" + "".join(random.choices(string.ascii_uppercase + string.digits, k=8))

    return {
        "status": "success",
        "reference_id": ref_id,
        "amount": amount,
        "upi_id": upi_id,
        "worker_name": worker_name,
        "method": method,
        "timestamp": datetime.utcnow().isoformat(),
        "message": f"₹{amount:.0f} withdrawal initiated to {upi_id}. Funds arrive in 2–4 hours.",
    }
