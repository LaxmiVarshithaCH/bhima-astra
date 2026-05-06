import logging
import random
from datetime import datetime, timedelta

from app.db.models.policy_claim import PolicyClaim
from app.services.ml_service import calculate_premium
from app.utils.cache_manager import PolicyCache
from sqlalchemy.orm import Session

logger = logging.getLogger("bhima.services.policy_service")


# 🔹 Plans config
PLAN_CONFIG = {
    "Basic": {"events": 2},
    "Standard": {"events": 2},
    "Premium": {"events": 2},
}


def generate_policy_id():
    return random.randint(10000, 99999)


# 🔥 Activate Policy
def activate_policy(db: Session, worker_id: int, plan_tier: str):
    # 1. Cancel all previously active policies for this worker
    existing_active = (
        db.query(PolicyClaim)
        .filter(
            PolicyClaim.worker_id == worker_id,
            PolicyClaim.policy_status == "active",
        )
        .all()
    )
    for old in existing_active:
        old.policy_status = "cancelled"
    if existing_active:
        db.flush()
        logger.info(
            f"[POLICY] Cancelled {len(existing_active)} old active policies for worker {worker_id}"
        )

    # 2. ML-driven premium + payouts — pass plan_tier so ML uses tier-specific payout rates
    ml_data = calculate_premium(db, worker_id, plan_tier.lower())
    weekly_premium = ml_data.get("personalized_premium", ml_data.get("base_premium", 79.0))
    payout_l1 = ml_data.get("payout_l1", 300.0)
    payout_l2 = ml_data.get("payout_l2", 600.0)
    payout_l3 = ml_data.get("payout_l3", 1200.0)

    # 3. Determine dates — weekly policy is 7 days
    today = datetime.utcnow().date()
    expiry = today + timedelta(days=7)

    # 4. Create the new active policy with ML-locked values
    policy = PolicyClaim(
        claim_id=random.randint(100000, 999999),
        worker_id=worker_id,
        policy_id=generate_policy_id(),
        plan_tier=plan_tier,
        weekly_premium=round(float(weekly_premium), 2),
        payout_l1=round(float(payout_l1), 2),
        payout_l2=round(float(payout_l2), 2),
        payout_l3=round(float(payout_l3), 2),
        activation_date=today,
        last_active_date=expiry,
        policy_status="active",
        eligibility_flag=True,
        events_used=0,
        events_remaining=PLAN_CONFIG[plan_tier]["events"],
        renewal_count=0,
        claim_auto_created=False,
        claim_valid_flag=False,
        payout_status="no_claim",
    )

    db.add(policy)
    db.commit()
    db.refresh(policy)

    # 5. Invalidate policy cache so the next GET /policies/me returns fresh data
    PolicyCache.invalidate_policy(worker_id)
    logger.info(
        f"[POLICY] Worker {worker_id} activated {plan_tier} plan "
        f"(premium={weekly_premium:.2f}, l1={payout_l1:.0f}, l2={payout_l2:.0f}, l3={payout_l3:.0f}, expires={expiry})"
    )

    return policy


# 🔹 Get Active Policy
def get_active_policy(db: Session, worker_id: int):
    # 🔥 CHECK CACHE FIRST (30 min TTL - policy changes infrequently)
    cached_policy = PolicyCache.get_active_policy(worker_id)
    if cached_policy:
        logger.info(f"[CACHE HIT] Active policy cache hit for worker {worker_id}")
        return cached_policy

    policy = (
        db.query(PolicyClaim)
        .filter(
            PolicyClaim.worker_id == worker_id, PolicyClaim.policy_status == "active"
        )
        .order_by(PolicyClaim.activation_date.desc())
        .first()
    )

    if not policy:
        return None

    # 🔥 CACHE THE ACTIVE POLICY — use ML-stored payouts (locked at activation)
    try:
        # Fallback payout values for policies activated before this migration
        from app.ml.premium_inference import PAYOUT_RATES_BASE
        _tier_key = (policy.plan_tier or "Standard").lower()
        _fallback = PAYOUT_RATES_BASE.get(_tier_key, {"L1": 300, "L2": 600, "L3": 1200})

        policy_dict = {
            "claim_id": policy.claim_id,
            "plan_tier": policy.plan_tier,
            "weekly_premium": float(policy.weekly_premium) if policy.weekly_premium is not None else None,
            "events_remaining": min(policy.events_remaining or 0, 2),
            "events_used": min(policy.events_used or 0, 2),
            "policy_status": policy.policy_status,
            "activation_date": str(policy.activation_date) if policy.activation_date is not None else None,
            "last_active_date": str(policy.last_active_date) if policy.last_active_date is not None else None,
            "policy_id": policy.policy_id,
            # ML-locked payouts — prefer stored value, fall back to PAYOUT_RATES_BASE for legacy rows
            "payout_l1": float(policy.payout_l1) if policy.payout_l1 is not None else float(_fallback["L1"]),
            "payout_l2": float(policy.payout_l2) if policy.payout_l2 is not None else float(_fallback["L2"]),
            "payout_l3": float(policy.payout_l3) if policy.payout_l3 is not None else float(_fallback["L3"]),
            # per_event_payout = L1 (base trigger), max_weekly = L3 * 2 (2 events/week)
            "per_event_payout": float(policy.payout_l1) if policy.payout_l1 is not None else float(_fallback["L1"]),
            "max_weekly_payout": round((float(policy.payout_l3) if policy.payout_l3 is not None else float(_fallback["L3"])) * 2, 2),
        }
        PolicyCache.set_active_policy(worker_id, policy_dict)
        return policy_dict
    except Exception as e:
        logger.debug(f"[CACHE] Failed to cache policy: {e}")

    return policy


# 🔹 Policy History
def get_policy_history(db: Session, worker_id: int):
    return (
        db.query(PolicyClaim)
        .filter(PolicyClaim.worker_id == worker_id)
        .order_by(PolicyClaim.activation_date.desc())
        .all()
    )


def get_policy_by_id(db: Session, policy_id: int):
    return db.query(PolicyClaim).filter(PolicyClaim.policy_id == policy_id).first()
