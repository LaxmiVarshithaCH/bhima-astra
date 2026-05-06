from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


class WorkerDetailInFraud(BaseModel):
    """Worker details included in fraud claim response"""

    model_config = {"from_attributes": True}

    worker_id: int
    worker_name: Optional[str] = None
    platform: Optional[str] = None
    geo_zone_id: Optional[str] = None
    city: Optional[str] = None
    vehicle_type: Optional[str] = None
    fraud_risk_score: Optional[float] = None
    kyc_verified: Optional[bool] = None
    bank_verified: Optional[bool] = None
    experience_level: Optional[float] = None
    shift_hours: Optional[float] = None


class FraudClaimResponse(BaseModel):
    """Fraud claim in list view"""

    model_config = {"from_attributes": True}

    claim_id: int
    worker_id: int
    worker_name: Optional[str] = None
    trigger_type: Optional[str] = None
    trigger_level: Optional[str] = None
    fraud_score: Optional[float] = None
    fraud_flag: Optional[bool] = None
    fraud_reason: Optional[str] = None
    claim_timestamp: Optional[datetime] = None
    payout_status: Optional[str] = None
    income_loss: Optional[float] = None


class FraudClaimListResponse(BaseModel):
    """Paginated list of fraud claims"""

    total: int
    page: int
    limit: int
    items: List[FraudClaimResponse]


class SHAPExplanation(BaseModel):
    """SHAP explanation data if available"""

    feature_name: str
    shap_value: float
    base_value: Optional[float] = None
    contribution: Optional[str] = None


class TriggerDetails(BaseModel):
    """Original trigger details from the claim"""

    trigger_type: Optional[str] = None
    trigger_level: Optional[str] = None
    trigger_value: Optional[float] = None
    trigger_evidence: Optional[str] = None
    claim_response_time_sec: Optional[float] = None
    app_interaction_count: Optional[int] = None


class LocationDetails(BaseModel):
    """GPS and location information"""

    gps_lat: Optional[float] = None
    gps_lng: Optional[float] = None
    cell_tower_id: Optional[str] = None
    gps_tower_delta: Optional[float] = None


class SensorData(BaseModel):
    """Sensor metrics from the device"""

    accelerometer_variance: Optional[float] = None


class FraudClaimDetailResponse(BaseModel):
    """Detailed fraud claim with full context"""

    model_config = {"from_attributes": True}

    claim_id: int
    worker_id: int
    worker: Optional[WorkerDetailInFraud] = None

    # Policy information
    policy_id: Optional[int] = None
    plan_tier: Optional[str] = None
    weekly_premium: Optional[float] = None
    policy_status: Optional[str] = None

    # Trigger details
    trigger_details: TriggerDetails

    # Fraud detection
    fraud_score: Optional[float] = None
    fraud_flag: Optional[bool] = None
    fraud_reason: Optional[str] = None
    shap_explanation: Optional[List[SHAPExplanation]] = None

    # Location and sensors
    location: Optional[LocationDetails] = None
    sensor_data: Optional[SensorData] = None

    # Claim status
    claim_timestamp: Optional[datetime] = None
    claim_valid_flag: Optional[bool] = None
    payout_status: Optional[str] = None
    payout_amount: Optional[float] = None
    payout_timestamp: Optional[datetime] = None

    # Income impact
    income_loss: Optional[float] = None
