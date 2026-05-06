from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class ClaimResponse(BaseModel):
    claim_id: int
    worker_id: int
    geo_zone_id: Optional[str] = None
    trigger_type: Optional[str] = None
    trigger_level: Optional[str] = None
    claim_timestamp: Optional[datetime] = None
    claim_valid_flag: bool
    payout_status: str
    payout_amount: Optional[float] = None
    payout_timestamp: Optional[datetime] = None
    fraud_flag: Optional[bool] = None
    fraud_score: Optional[float] = None


class ClaimDetailResponse(BaseModel):
    claim_id: int
    worker_id: int
    geo_zone_id: Optional[str] = None
    trigger_type: Optional[str] = None
    trigger_level: Optional[str] = None
    trigger_value: Optional[float] = None
    income_loss: Optional[float] = None
    fraud_score: Optional[float] = None
    fraud_flag: Optional[bool] = None
    claim_valid_flag: bool
    payout_status: str
    payout_amount: Optional[float] = None
    payout_timestamp: Optional[datetime] = None
    claim_timestamp: Optional[datetime] = None


class ActionResponse(BaseModel):
    status: str
