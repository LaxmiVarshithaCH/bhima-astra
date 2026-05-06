from sqlalchemy import text

def auto_verify_and_trigger(db):
    
    # 1. Get pending flags
    flags = db.execute(text("""
        SELECT *
        FROM manager_disruption_flags
        WHERE flag_status = 'pending'
    """)).fetchall()

    results = []

    for flag in flags:
        
        # 🔥 SIMPLE RULE (you can upgrade later)
        # verify everything for now
        db.execute(text("""
            UPDATE manager_disruption_flags
            SET flag_status = 'verified',
                payout_enabled = true
            WHERE flag_id = :flag_id
        """), {"flag_id": flag.flag_id})

        # 2. Get workers in that zone
        workers = db.execute(text("""
            SELECT worker_id
            FROM workers
            WHERE geo_zone_id = :zone_id
        """), {"zone_id": flag.zone_id}).fetchall()

        # 3. Push to payout queue
        for w in workers:
            db.execute(text("""
                INSERT INTO offline_payout_queue (
                    worker_id,
                    flag_id,
                    days_worked_this_week,
                    payout_amount,
                    queue_status,
                    queued_at
                )
                VALUES (
                    :worker_id,
                    :flag_id,
                    5,
                    1000,
                    'pending',
                    NOW()
                )
            """), {
                "worker_id": w.worker_id,
                "flag_id": flag.flag_id
            })

        results.append({
            "flag_id": flag.flag_id,
            "zone": flag.zone_id,
            "workers_affected": len(workers)
        })

    db.commit()

    return {"status": "auto verification complete", "details": results}

from sqlalchemy import text


def get_all_flags(db):
    result = db.execute(text("""
        SELECT *
        FROM manager_disruption_flags
        ORDER BY created_at DESC
    """)).fetchall()

    return [
        {
            "flag_id": r.flag_id,
            "manager_id": r.manager_id,
            "zone_id": r.zone_id,
            "disruption_type": r.disruption_type,
            "description": r.description,
            "flag_status": r.flag_status,
            "payout_enabled": r.payout_enabled,
            "created_at": r.created_at
        }
        for r in result
    ]


def verify_flag(db, flag_id):
    db.execute(text("""
        UPDATE manager_disruption_flags
        SET flag_status = 'verified',
            payout_enabled = true
        WHERE flag_id = :flag_id
    """), {"flag_id": flag_id})

    db.commit()
    return {"status": "flag verified manually"}


def reject_flag(db, flag_id):
    db.execute(text("""
        UPDATE manager_disruption_flags
        SET flag_status = 'rejected',
            payout_enabled = false
        WHERE flag_id = :flag_id
    """), {"flag_id": flag_id})

    db.commit()
    return {"status": "flag rejected"}


def get_payout_queue(db):
    result = db.execute(text("""
        SELECT *
        FROM offline_payout_queue
        ORDER BY queued_at DESC
    """)).fetchall()

    return [
        {
            "queue_id": r.queue_id,
            "worker_id": r.worker_id,
            "flag_id": r.flag_id,
            "payout_amount": r.payout_amount,
            "queue_status": r.queue_status,
            "queued_at": r.queued_at
        }
        for r in result
    ]