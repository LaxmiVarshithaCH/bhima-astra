from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime


# 🔥 TRIGGER EVENT
class TriggerEvent(BaseModel):
    zone_id: str
    trigger_type: str
    severity: str
    created_at: datetime


# 🔥 FRAUD ALERT
class FraudAlert(BaseModel):
    claim_id: int
    worker_id: int
    fraud_score: float
    fraud_flag: bool
    trigger_type: str
    created_at: datetime


# 🔥 AUDIT EVENT
class AuditEvent(BaseModel):
    agent_name: str
    action: str
    entity_type: str
    entity_id: int
    payload: Optional[dict]
    created_at: datetime