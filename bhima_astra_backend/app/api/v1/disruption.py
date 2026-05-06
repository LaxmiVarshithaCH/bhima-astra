from datetime import datetime
from typing import List, Optional

from app.db.session import get_db
from app.schemas.disruption import (
    CombinedDisruptionItem,
    DisruptionListResponse,
    EnvironmentalDisruption,
    ManagerFlagUpdateRequest,
    ManagerFlagUpdateResponse,
)
from app.schemas.disruption import (
    ManagerDisruptionFlag as ManagerDisruptionFlagSchema,
)
from app.services.disruption_service import (
    combine_disruptions,
    get_all_disruptions,
    get_environmental_disruptions,
    get_manager_disruption_flags,
    update_manager_flag,
)
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

router = APIRouter(prefix="/api/v1/admin/disruptions", tags=["Admin Disruptions"])


@router.get("/all", response_model=DisruptionListResponse)
def get_all_disruptions_endpoint(
    db: Session = Depends(get_db),
    zone_id: Optional[str] = Query(None, description="Filter by zone ID"),
):
    """
    Get all disruptions (environmental + manager-reported).

    Combines environmental disruptions from zone_live_cache with manager-reported
    disruption flags. Returns sorted by severity (L1 > L2 > L3) and timestamp (newest first).

    **Query Parameters:**
    - **zone_id**: Optional zone filter

    **Returns:** Combined list of environmental and manager disruptions.

    **Example Response:**
    ```json
    {
        "total": 5,
        "environmental_count": 2,
        "manager_flags_count": 3,
        "items": [
            {
                "disruption_id": "ZONE_1_env_rainfall",
                "type": "environmental",
                "zone_id": "ZONE_1",
                "disruption_type": "rainfall",
                "severity_level": "L2",
                "timestamp": "2024-01-15T10:30:00",
                "workers_affected": 45
            },
            {
                "disruption_id": 123,
                "type": "manager_flag",
                "zone_id": "ZONE_1",
                "disruption_type": "road_closure",
                "status": "verified",
                "timestamp": "2024-01-15T09:00:00"
            }
        ]
    }
    ```
    """
    try:
        environmental, manager_flags = get_all_disruptions(db, zone_id)

        # Combine and sort
        combined = combine_disruptions(environmental, manager_flags)

        # Convert to response format
        items = []
        for item in combined:
            combined_item = CombinedDisruptionItem(
                disruption_id=item["disruption_id"],
                type=item["type"],
                zone_id=item["zone_id"],
                disruption_type=item["disruption_type"],
                description=item.get("description"),
                severity_level=item.get("severity_level"),
                status=item.get("status"),
                timestamp=item.get("timestamp", datetime.utcnow()),
                workers_affected=item.get("workers_affected"),
                estimated_payout=item.get("estimated_payout"),
                environmental_data=(
                    EnvironmentalDisruption.model_validate(item["environmental_data"])
                    if item.get("environmental_data")
                    else None
                ),
                manager_flag_data=(
                    ManagerDisruptionFlagSchema.model_validate(
                        item["manager_flag_data"]
                    )  # type: ignore
                    if item.get("manager_flag_data")
                    else None
                ),
            )
            items.append(combined_item)

        return DisruptionListResponse(
            total=len(combined),
            environmental_count=len(environmental),
            manager_flags_count=len(manager_flags),
            items=items,
        )
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error fetching disruptions: {str(e)}"
        )


@router.post("/flags/{flag_id}/action", response_model=ManagerFlagUpdateResponse)
def update_disruption_flag(
    flag_id: int,
    request: ManagerFlagUpdateRequest,
    db: Session = Depends(get_db),
):
    """
    Update manager disruption flag status after admin review.

    **Path Parameters:**
    - **flag_id**: Manager disruption flag ID

    **Request Body:**
    ```json
    {
        "action": "verify",
        "admin_id": 1,
        "notes": "Verified with field team",
        "payout_enabled": true
    }
    ```

    **Parameters:**
    - **action**: "verify" to confirm disruption, "reject" to dismiss
    - **admin_id**: Admin user ID performing the action
    - **notes**: Optional notes from admin
    - **payout_enabled**: Whether to enable payouts for affected workers

    **Returns:** Updated flag with status and verification info.

    **Example Response:**
    ```json
    {
        "flag_id": 123,
        "zone_id": "ZONE_1",
        "disruption_type": "road_closure",
        "flag_status": "verified",
        "admin_verified": true,
        "verified_by": 1,
        "verified_at": "2024-01-15T10:30:00",
        "payout_enabled": true,
        "message": "Flag verified and payouts enabled"
    }
    ```
    """
    try:
        # Validate action
        if request.action not in ["verify", "reject"]:
            raise HTTPException(
                status_code=400,
                detail="Action must be 'verify' or 'reject'",
            )

        # Update flag
        updated_flag = update_manager_flag(
            db,
            flag_id,
            request.action,
            request.admin_id,
            request.notes,
            request.payout_enabled,
        )

        if not updated_flag:
            raise HTTPException(status_code=404, detail="Flag not found")

        # Build message
        if request.action == "verify":
            message = (
                "Flag verified and payouts enabled"
                if request.payout_enabled
                else "Flag verified"
            )
        else:
            message = "Flag rejected"

        return ManagerFlagUpdateResponse(  # type: ignore
            flag_id=updated_flag.flag_id,
            zone_id=updated_flag.zone_id,
            disruption_type=updated_flag.disruption_type,
            flag_status=updated_flag.flag_status,
            admin_verified=updated_flag.admin_verified or False,
            verified_by=updated_flag.verified_by,
            verified_at=updated_flag.verified_at,
            payout_enabled=updated_flag.payout_enabled,
            message=message,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating flag: {str(e)}")


@router.get("/flags", response_model=List[ManagerDisruptionFlagSchema])
def get_manager_flags(
    db: Session = Depends(get_db),
    zone_id: Optional[str] = Query(None, description="Filter by zone ID"),
    status: Optional[str] = Query(
        None, description="Filter by status: pending|verified|rejected|resolved"
    ),
):
    """
    Get manager-reported disruption flags.

    **Query Parameters:**
    - **zone_id**: Optional zone filter
    - **status**: Optional status filter (pending|verified|rejected|resolved)

    **Returns:** List of manager disruption flags.
    """
    try:
        flags = get_manager_disruption_flags(db, zone_id, status)
        return [ManagerDisruptionFlagSchema.model_validate(flag) for flag in flags]  # type: ignore
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching flags: {str(e)}")


@router.get("/environmental", response_model=List[EnvironmentalDisruption])
def get_environmental_data(
    db: Session = Depends(get_db),
    zone_id: Optional[str] = Query(None, description="Filter by zone ID"),
):
    """
    Get environmental disruptions from zone live data.

    Analyzes rainfall, temperature, and AQI from latest operations.

    **Query Parameters:**
    - **zone_id**: Optional zone filter

    **Returns:** List of environmental disruptions with severity levels.
    """
    try:
        disruptions = get_environmental_disruptions(db, zone_id)
        return [EnvironmentalDisruption.model_validate(d) for d in disruptions]
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error fetching environmental data: {str(e)}"
        )
