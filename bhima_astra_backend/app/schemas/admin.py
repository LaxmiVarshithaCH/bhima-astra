from pydantic import BaseModel
from datetime import datetime
from typing import Optional

# ✅ Flag Response (Admin View)
class AdminFlagResponse(BaseModel):
    flag_id: int
    manager_id: int
    zone_id: str
    disruption_type: str
    description: Optional[str]
    flag_status: str
    payout_enabled: bool
    created_at: datetime


# ✅ Payout Queue Response
class PayoutQueueResponse(BaseModel):
    queue_id: int
    worker_id: int
    flag_id: int
    payout_amount: float
    queue_status: str
    queued_at: datetime


# ✅ Generic Response
class MessageResponse(BaseModel):
    status: str