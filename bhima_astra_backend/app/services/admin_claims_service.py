from sqlalchemy import text, func
from datetime import datetime


# 🔍 ALL CLAIMS — joined with workers to include geo_zone_id
def get_all_claims(db):
    result = db.execute(
        text("""
        SELECT
            pc.claim_id,
            pc.worker_id,
            w.geo_zone_id,
            pc.trigger_type,
            pc.trigger_level,
            pc.claim_timestamp,
            pc.claim_valid_flag,
            pc.payout_status,
            pc.payout_amount,
            pc.payout_timestamp,
            pc.fraud_flag,
            pc.fraud_score
        FROM policy_claims pc
        LEFT JOIN workers w ON pc.worker_id = w.worker_id
        WHERE pc.claim_timestamp IS NOT NULL
        ORDER BY pc.claim_timestamp DESC
        LIMIT 100
    """)
    ).fetchall()

    return [dict(r._mapping) for r in result]


# 🔍 CLAIM DETAIL
def get_claim_detail(db, claim_id):
    result = db.execute(
        text("""
        SELECT pc.*, w.worker_name, w.geo_zone_id, w.city, w.platform, w.fraud_risk_score
        FROM policy_claims pc
        LEFT JOIN workers w ON pc.worker_id = w.worker_id
        WHERE pc.claim_id = :claim_id
    """),
        {"claim_id": claim_id},
    ).fetchone()

    return dict(result._mapping) if result else None


# ✅ APPROVE CLAIM
def approve_claim(db, claim_id):
    db.execute(
        text("""
        UPDATE policy_claims
        SET payout_status = 'approved'
        WHERE claim_id = :claim_id
    """),
        {"claim_id": claim_id},
    )

    db.commit()

    return {"status": "claim approved"}


# ❌ REJECT CLAIM
def reject_claim(db, claim_id):
    db.execute(
        text("""
        UPDATE policy_claims
        SET payout_status = 'rejected'
        WHERE claim_id = :claim_id
    """),
        {"claim_id": claim_id},
    )

    db.commit()
    return {"status": "claim rejected"}


# 💰 PENDING PAYOUTS — includes zone info
def get_pending_payouts(db):
    result = db.execute(
        text("""
        SELECT
            pc.claim_id,
            pc.worker_id,
            w.geo_zone_id,
            pc.payout_amount,
            pc.trigger_type,
            pc.claim_timestamp
        FROM policy_claims pc
        LEFT JOIN workers w ON pc.worker_id = w.worker_id
        WHERE pc.payout_status = 'approved'
        ORDER BY pc.claim_timestamp DESC
        LIMIT 50
    """)
    ).fetchall()

    return [dict(r._mapping) for r in result]


def release_payout(db, claim_id):

    # 🔍 Check current status
    claim = db.execute(
        text("""
        SELECT payout_status
        FROM policy_claims
        WHERE claim_id = :claim_id
    """),
        {"claim_id": claim_id},
    ).fetchone()

    if not claim:
        return {"status": "claim not found"}

    if claim.payout_status == "paid":
        return {"status": "already paid"}

    if claim.payout_status != "approved":
        return {"status": f"cannot release payout (status: {claim.payout_status})"}

    # 💸 Release payout
    db.execute(
        text("""
        UPDATE policy_claims
        SET payout_status = 'paid',
            payout_timestamp = NOW()
        WHERE claim_id = :claim_id
    """),
        {"claim_id": claim_id},
    )

    db.commit()

    # Send websocket event to all connected clients
    try:
        from app.utils.ws_helper import send_ws_event_sync

        send_ws_event_sync(
            {
                "type": "PAYOUT_RELEASED",
                "claim_id": claim_id,
                "message": f"Payout released for claim {claim_id}",
            }
        )
    except Exception:
        pass

    return {"status": "payout released successfully"}


# 💳 RAZORPAY PAYOUT STATS — Aggregate stats and recent transactions
def get_razorpay_payout_stats(db):
    """
    Get Razorpay payout statistics and recent transactions.
    Returns successful payouts count, failed count, total amount, and recent transactions.
    """
    try:
        # Get aggregate stats for all payout_transactions
        stats = db.execute(
            text("""
            SELECT
                COUNT(CASE WHEN status = 'success' THEN 1 END) as successful_payouts,
                COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_payouts,
                COALESCE(SUM(CASE WHEN status = 'success' THEN amount ELSE 0 END), 0) as total_amount_inr
            FROM payout_transactions
            WHERE created_at IS NOT NULL
        """)
        ).fetchone()

        # Get recent transactions
        recent_txns = db.execute(
            text("""
            SELECT
                pt.transaction_id,
                pt.claim_id,
                pt.worker_id,
                w.worker_name,
                w.upi_id,
                pt.amount,
                pt.status,
                pt.payment_reference,
                pt.created_at
            FROM payout_transactions pt
            LEFT JOIN workers w ON pt.worker_id = w.worker_id
            ORDER BY pt.created_at DESC
            LIMIT 20
        """)
        ).fetchall()

        # Find last payout timestamp
        last_payout = db.execute(
            text("""
            SELECT MAX(created_at) as last_payout_at
            FROM payout_transactions
            WHERE status = 'success'
        """)
        ).fetchone()

        return {
            "successful_payouts": stats.successful_payouts or 0,
            "failed_payouts": stats.failed_payouts or 0,
            "total_amount_inr": float(stats.total_amount_inr or 0),
            "last_payout_at": last_payout.last_payout_at.isoformat() if last_payout.last_payout_at else None,
            "recent_transactions": [
                {
                    "transaction_id": t.transaction_id,
                    "claim_id": t.claim_id,
                    "worker_id": t.worker_id,
                    "worker_name": t.worker_name or "Unknown",
                    "upi_id": t.upi_id or "N/A",
                    "amount": float(t.amount or 0),
                    "status": t.status or "unknown",
                    "payment_reference": t.payment_reference or "N/A",
                    "created_at": t.created_at.isoformat() if t.created_at else None,
                }
                for t in recent_txns
            ]
        }
    except Exception as e:
        # Fallback response if database query fails
        return {
            "successful_payouts": 0,
            "failed_payouts": 0,
            "total_amount_inr": 0,
            "last_payout_at": None,
            "recent_transactions": []
        }
