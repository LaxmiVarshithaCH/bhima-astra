from typing import Optional

from pydantic import BaseModel


class WorkerProfileResponse(BaseModel):
    model_config = {"from_attributes": True}

    worker_id: int
    worker_name: Optional[str] = None
    platform: Optional[str] = None
    city: Optional[str] = None
    geo_zone_id: Optional[str] = None
    vehicle_type: Optional[str] = None
    shift_hours: Optional[float] = None
    experience_level: Optional[float] = None
    employment_type: Optional[str] = None
    upi_id: Optional[str] = None
    bank_ifsc: Optional[str] = None
    kyc_verified: Optional[bool] = None
    bank_verified: Optional[bool] = None
    fraud_risk_score: Optional[float] = None
    payment_verified_status: Optional[str] = None
    phone_number: Optional[str] = None


class PayoutItemResponse(BaseModel):
    model_config = {"from_attributes": True}

    claim_id: int
    worker_id: Optional[int] = None
    plan_tier: Optional[str] = None
    trigger_type: Optional[str] = None
    trigger_level: Optional[str] = None
    trigger_value: Optional[float] = None
    payout_status: Optional[str] = None
    payout_amount: Optional[float] = None
    fraud_score: Optional[float] = None
    fraud_flag: Optional[bool] = None
    fraud_reason: Optional[str] = None
    income_loss: Optional[float] = None
    claim_timestamp: Optional[str] = None
    payout_timestamp: Optional[str] = None


class EarningsEstimateResponse(BaseModel):
    avg_income: float
    expected_orders: Optional[int] = None
    expected_income: Optional[float] = None
    actual_income_today: Optional[float] = None
    income_gap: Optional[float] = None


class DailyOperationResponse(BaseModel):
    model_config = {"from_attributes": True}

    date: Optional[str] = None
    daily_income: Optional[float] = None
    income_loss: Optional[float] = None
    composite_score: Optional[float] = None
    disruption_flag: Optional[bool] = None


class WorkerUpdateRequest(BaseModel):
    worker_name: Optional[str] = None
    city: Optional[str] = None
    platform: Optional[str] = None
    geo_zone_id: Optional[str] = None
    vehicle_type: Optional[str] = None
    shift_hours: Optional[float] = None
    employment_type: Optional[str] = None
    upi_id: Optional[str] = None
