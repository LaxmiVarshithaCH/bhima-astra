from app.db.models.worker import Worker
from app.db.session import get_db
from app.schemas.fraud import (
    FraudClaimDetailResponse,
    FraudClaimListResponse,
    FraudClaimResponse,
    LocationDetails,
    SensorData,
    TriggerDetails,
    WorkerDetailInFraud,
)
from app.services.fraud_service import get_fraud_claim_detail, get_fraud_claims
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

router = APIRouter(prefix="/api/v1/admin/fraud", tags=["Admin Fraud Detection"])


@router.get("/claims", response_model=FraudClaimListResponse)
def get_fraud_claims_list(
    db: Session = Depends(get_db),
    status: str = Query("flagged", description="Filter by status: flagged or held"),
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    limit: int = Query(50, ge=1, le=50, description="Items per page (max 50)"),
):
    """
    Get all fraud-flagged claims or held claims.

    **Query Parameters:**
    - **status**: "flagged" (fraud_flag=True) or "held" (claim_valid_flag=False)
    - **page**: Page number for pagination (1-indexed)
    - **limit**: Items per page (max 50)

    **Returns:** Paginated list with claim details and worker information.

    **Example Response:**
    ```json
    {
        "total": 15,
        "page": 1,
        "limit": 50,
        "items": [
            {
                "claim_id": 12345,
                "worker_id": 789,
                "worker_name": "John Doe",
                "trigger_type": "rainfall",
                "fraud_score": 0.85,
                "fraud_flag": true,
                "fraud_reason": "Suspicious GPS pattern",
                "claim_timestamp": "2024-01-15T10:30:00"
            }
        ]
    }
    ```
    """
    try:
        result = get_fraud_claims(db, status=status, page=page, limit=limit)

        # Convert claims to response format
        items = []
        for claim in result["items"]:
            # Get worker details
            worker = (
                db.query(Worker).filter(Worker.worker_id == claim.worker_id).first()
            )

            item = FraudClaimResponse(
                claim_id=claim.claim_id,
                worker_id=claim.worker_id,
                worker_name=worker.worker_name if worker else None,  # type: ignore
                trigger_type=claim.trigger_type,
                trigger_level=claim.trigger_level,
                fraud_score=claim.fraud_score,
                fraud_flag=claim.fraud_flag,
                fraud_reason=claim.fraud_reason,
                claim_timestamp=claim.claim_timestamp,
                payout_status=claim.payout_status,
                income_loss=claim.income_loss,
            )
            items.append(item)

        return FraudClaimListResponse(
            total=result["total"],
            page=result["page"],
            limit=result["limit"],
            items=items,
        )
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error fetching fraud claims: {str(e)}"
        )


@router.get("/claims/{claim_id}", response_model=FraudClaimDetailResponse)
def get_fraud_claim_details(claim_id: int, db: Session = Depends(get_db)):
    """
    Get detailed information for a specific fraud claim.

    **Includes:**
    - Full worker profile (name, zone, platform, KYC status)
    - Complete trigger details (type, level, evidence)
    - Fraud detection metrics (score, flag, reason)
    - Location and sensor data (GPS, accelerometer)
    - Policy information
    - Payout status and timeline

    **Example Response:**
    ```json
    {
        "claim_id": 12345,
        "worker_id": 789,
        "worker": {
            "worker_id": 789,
            "worker_name": "John Doe",
            "platform": "Uber",
            "geo_zone_id": "ZONE_BANGALORE_1",
            "city": "Bangalore",
            "fraud_risk_score": 0.45
        },
        "trigger_type": "rainfall",
        "fraud_score": 0.85,
        "fraud_flag": true,
        "fraud_reason": "Suspicious GPS pattern detected",
        "location": {
            "gps_lat": 12.9716,
            "gps_lng": 77.5946
        }
    }
    ```
    """
    try:
        data = get_fraud_claim_detail(db, claim_id)

        if not data:
            raise HTTPException(status_code=404, detail="Claim not found")

        claim = data["claim"]
        worker = data["worker"]

        # Build worker detail response
        if worker:
            worker_detail = WorkerDetailInFraud(
                worker_id=worker.worker_id,
                worker_name=worker.worker_name,
                platform=worker.platform,
                geo_zone_id=worker.geo_zone_id,
                city=worker.city,
                vehicle_type=worker.vehicle_type,
                fraud_risk_score=worker.fraud_risk_score,
                kyc_verified=worker.kyc_verified,
                bank_verified=worker.bank_verified,
                experience_level=worker.experience_level,
                shift_hours=worker.shift_hours,
            )
        else:
            # Provide minimal worker detail with at least worker_id
            worker_detail = WorkerDetailInFraud(worker_id=claim.worker_id)

        # Build trigger details
        trigger_details = TriggerDetails(
            trigger_type=claim.trigger_type,
            trigger_level=claim.trigger_level,
            trigger_value=claim.trigger_value,
            trigger_evidence=claim.trigger_evidence,
            claim_response_time_sec=claim.claim_response_time_sec,
            app_interaction_count=claim.app_interaction_count,
        )

        # Build location details if available
        location = None
        if claim.gps_lat or claim.gps_lng:
            location = LocationDetails(
                gps_lat=claim.gps_lat,
                gps_lng=claim.gps_lng,
                cell_tower_id=claim.cell_tower_id,
                gps_tower_delta=claim.gps_tower_delta,
            )

        # Build sensor data if available
        sensor_data = None
        if claim.accelerometer_variance:
            sensor_data = SensorData(
                accelerometer_variance=claim.accelerometer_variance,
            )

        return FraudClaimDetailResponse(
            claim_id=claim.claim_id,
            worker_id=claim.worker_id,
            worker=worker_detail,
            policy_id=claim.policy_id,
            plan_tier=claim.plan_tier,
            weekly_premium=claim.weekly_premium,
            policy_status=claim.policy_status,
            trigger_details=trigger_details,
            fraud_score=claim.fraud_score,
            fraud_flag=claim.fraud_flag,
            fraud_reason=claim.fraud_reason,
            location=location,
            sensor_data=sensor_data,
            claim_timestamp=claim.claim_timestamp,
            claim_valid_flag=claim.claim_valid_flag,
            payout_status=claim.payout_status,
            payout_amount=claim.payout_amount,
            payout_timestamp=claim.payout_timestamp,
            income_loss=claim.income_loss,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error fetching claim details: {str(e)}"
        )
