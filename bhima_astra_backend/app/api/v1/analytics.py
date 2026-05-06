from typing import Any, Dict, Optional

from app.db.session import get_db
from app.services.analytics_service import (
    get_loss_ratio_analytics,
    get_loss_ratio_by_plan,
    get_loss_ratio_trend,
)
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

router = APIRouter(prefix="/api/v1/admin/analytics", tags=["Admin Analytics"])


@router.get("/loss-ratio")
def fetch_loss_ratio(
    db: Session = Depends(get_db),
    from_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    to_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    city_tier: Optional[str] = Query(None, description="Filter by city tier"),
    plan_tier: Optional[str] = Query(None, description="Filter by plan tier"),
) -> Dict[str, Any]:
    """
    Get loss ratio analytics for the specified period.

    Loss Ratio = Total Payouts / Total Premiums

    Query Parameters:
    - from_date: Start date (YYYY-MM-DD), defaults to 12 weeks ago
    - to_date: End date (YYYY-MM-DD), defaults to today
    - city_tier: Filter by city tier (tier1, tier2, tier3)
    - plan_tier: Filter by plan tier (basic, standard, premium)
    """
    return get_loss_ratio_analytics(
        db,
        from_date=from_date,
        to_date=to_date,
        city_tier=city_tier,
        plan_tier=plan_tier,
    )


@router.get("/loss-ratio/by-plan")
def fetch_loss_ratio_by_plan(
    db: Session = Depends(get_db),
    from_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    to_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
) -> Dict[str, Any]:
    """
    Get loss ratio broken down by plan tier.
    """
    return get_loss_ratio_by_plan(db, from_date=from_date, to_date=to_date)


@router.get("/loss-ratio/trend")
def fetch_loss_ratio_trend(
    db: Session = Depends(get_db),
    weeks: int = Query(12, ge=1, le=52, description="Number of weeks to include"),
) -> Dict[str, Any]:
    """
    Get weekly loss ratio trend.

    Query Parameters:
    - weeks: Number of weeks to include (default: 12, max: 52)
    """
    return get_loss_ratio_trend(db, weeks=weeks)
