from app.utils.cache_manager import AdminStatsCache
from sqlalchemy import text


# 🔴 LIVE TRIGGERS (from flags + forecast)
def get_live_triggers(db):
    cached = AdminStatsCache.get_triggers()
    if cached is not None:
        return cached

    result = db.execute(
        text("""
        SELECT
            zone_id,
            disruption_type AS trigger_type,
            flag_status AS severity,
            created_at
        FROM manager_disruption_flags
        WHERE flag_status IN ('pending', 'verified')
        ORDER BY created_at DESC
        LIMIT 20
    """)
    ).fetchall()

    data = [
        {
            "zone_id": r.zone_id,
            "trigger_type": r.trigger_type,
            "severity": r.severity,
            "created_at": r.created_at,
        }
        for r in result
    ]
    AdminStatsCache.set_triggers(data)
    return data


# 🚨 FRAUD ALERTS
def get_fraud_alerts(db):
    cached = AdminStatsCache.get_fraud_alerts()
    if cached is not None:
        return cached

    result = db.execute(
        text("""
        SELECT
            claim_id,
            worker_id,
            fraud_score,
            fraud_flag,
            trigger_type,
            claim_timestamp AS created_at
        FROM policy_claims
        WHERE fraud_flag = true
        ORDER BY claim_timestamp DESC
        LIMIT 20
    """)
    ).fetchall()

    data = [
        {
            "claim_id": r.claim_id,
            "worker_id": r.worker_id,
            "fraud_score": float(r.fraud_score),
            "fraud_flag": r.fraud_flag,
            "trigger_type": r.trigger_type,
            "created_at": r.created_at,
        }
        for r in result
    ]
    AdminStatsCache.set_fraud_alerts(data)
    return data


# 📜 RECENT SYSTEM ACTIVITY (audit logs)
def get_recent_activity(db):
    cached = AdminStatsCache.get_recent_activity()
    if cached is not None:
        return cached

    result = db.execute(
        text("""
        SELECT *
        FROM audit_log
        ORDER BY created_at DESC
        LIMIT 20
    """)
    ).fetchall()

    data = [
        {
            "agent_name": r.agent_name,
            "action": r.action,
            "entity_type": r.entity_type,
            "entity_id": r.entity_id,
            "payload": r.payload,
            "created_at": r.created_at,
        }
        for r in result
    ]
    AdminStatsCache.set_recent_activity(data)
    return data
