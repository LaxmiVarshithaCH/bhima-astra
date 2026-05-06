from app.core.deps import get_current_worker
from app.db.session import get_db
from app.services.policy_service import (
    activate_policy,
    get_active_policy,
    get_policy_history,
)
from app.utils.cache_manager import PlanComparisonCache
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

router = APIRouter(prefix="/policies", tags=["Policies"])


# 🔹 Compare Plans — ML-personalised per authenticated worker
@router.get("/plans/compare")
def compare_plans(
    city: str = "Mumbai",
    db: Session = Depends(get_db),
    current_worker=Depends(get_current_worker),
):
    from app.ml.premium_inference import CITY_TIER_MULTIPLIERS, get_city_tier
    from app.services.ml_service import calculate_premium

    city_tier = get_city_tier(city)
    city_mult = CITY_TIER_MULTIPLIERS.get(city_tier, 1.0)

    plans = []
    for plan_name in ["basic", "standard", "premium"]:
        ml_data = calculate_premium(db, current_worker.worker_id, plan_name)
        plans.append(
            {
                "tier": plan_name,
                "weekly_premium": ml_data.get("personalized_premium", 79.0),
                "base_premium": ml_data.get("base_premium", 79.0),
                "city_multiplier": city_mult,
                "payout_l1": ml_data.get("payout_l1", 300.0),
                "payout_l2": ml_data.get("payout_l2", 600.0),
                "payout_l3": ml_data.get("payout_l3", 1200.0),
                "max_events": 2,
            }
        )

    return {
        "city": city.title(),
        "city_tier": city_tier,
        "tier_label": f"tier{city_tier}",
        "multiplier": city_mult,
        "plans": plans,
        "cached": False,
    }


# 🔥 Activate Policy
@router.post("/activate")
def activate(
    req: dict, db: Session = Depends(get_db), current_worker=Depends(get_current_worker)
):
    plan = req.get("plan_tier")

    if plan not in ["Basic", "Standard", "Premium"]:
        raise HTTPException(status_code=400, detail="Invalid plan")

    return activate_policy(db, current_worker.worker_id, plan)


@router.get("/me")
def get_my_policy(
    db: Session = Depends(get_db), current_worker=Depends(get_current_worker)
):
    result = get_active_policy(db, current_worker.worker_id)

    if not result:
        return {"message": "No active policy"}

    # If cached path returned a dict, return directly
    if isinstance(result, dict):
        return result

    # ORM fallback: use stored ML payout values; fall back to PAYOUT_RATES_BASE for legacy rows
    from app.ml.premium_inference import PAYOUT_RATES_BASE
    _tier_key = (result.plan_tier or "Standard").lower()
    _fallback = PAYOUT_RATES_BASE.get(_tier_key, {"L1": 300, "L2": 600, "L3": 1200})
    _l1 = float(result.payout_l1) if result.payout_l1 is not None else float(_fallback["L1"])
    _l2 = float(result.payout_l2) if result.payout_l2 is not None else float(_fallback["L2"])
    _l3 = float(result.payout_l3) if result.payout_l3 is not None else float(_fallback["L3"])

    return {
        "claim_id": result.claim_id,
        "plan_tier": result.plan_tier,
        "weekly_premium": float(result.weekly_premium) if result.weekly_premium is not None else None,
        "events_remaining": min(result.events_remaining or 0, 2),
        "events_used": min(result.events_used or 0, 2),
        "policy_status": result.policy_status,
        "activation_date": str(result.activation_date) if result.activation_date else None,
        "last_active_date": str(result.last_active_date) if result.last_active_date else None,
        "policy_id": result.policy_id,
        "payout_l1": _l1,
        "payout_l2": _l2,
        "payout_l3": _l3,
        "per_event_payout": _l1,
        "max_weekly_payout": round(_l3 * 2, 2),
    }


# 🔹 History
@router.get("/history")
def history(db: Session = Depends(get_db), current_worker=Depends(get_current_worker)):
    return get_policy_history(db, current_worker.worker_id)


from app.services.policy_service import get_policy_by_id


@router.get("/{policy_id}")
def get_policy(policy_id: int, db: Session = Depends(get_db)):
    policy = get_policy_by_id(db, policy_id)

    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")

    return policy
