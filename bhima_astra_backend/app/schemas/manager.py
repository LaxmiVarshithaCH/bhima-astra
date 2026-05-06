from datetime import datetime
from typing import Any, List, Optional

from pydantic import BaseModel, Field


class ManagerLoginRequest(BaseModel):
    email: str
    password: str


class CreateFlagRequest(BaseModel):
    manager_id: int
    zone_id: str
    disruption_type: str  # curfew / strike / road_blockage / protests / zone_shutdown
    description: str
    evidence_url: Optional[str] = None
    estimated_start: Optional[str] = None
    estimated_end: Optional[str] = None
    workers_in_zone: Optional[int] = None        # frontend-computed affected count
    estimated_payout: Optional[float] = None     # frontend-computed payout amount
    affected_worker_ids: Optional[List[int]] = None  # real DB worker IDs affected



class FlagResponse(BaseModel):
    flag_id: int
    manager_id: int
    zone_id: str
    disruption_type: str
    description: Optional[str] = None
    evidence_url: Optional[str] = None
    estimated_start: Optional[str] = None
    estimated_end: Optional[str] = None
    flag_status: str
    payout_enabled: bool
    flagged_at: Optional[str] = None


class WorkerInZone(BaseModel):
    worker_id: int
    worker_name: Optional[str] = None
    platform: Optional[str] = None
    vehicle_type: Optional[str] = None
    geo_zone_id: Optional[str] = None
    fraud_risk_score: Optional[float] = None
    kyc_verified: Optional[bool] = None
    payment_verified_status: Optional[str] = None
    upi_id: Optional[str] = None
    # derived fields
    policy_status: Optional[str] = None
    plan_tier: Optional[str] = None


class ManagerProfile(BaseModel):
    manager_id: int
    manager_name: Optional[str] = None
    email: Optional[str] = None
    assigned_zones: List[str] = []


class ManagerDashboardStats(BaseModel):
    new_registrations: int = 0
    payouts_processed: float = 0.0
    flags_raised: int = 0
    offline_workers_paid: int = 0
    fraud_holds: int = 0
    total_active_workers: int = 0
    total_active_policies: int = 0


class TriggerEventResponse(BaseModel):
    claim_id: int
    zone_id: Optional[str] = None
    trigger_type: Optional[str] = None
    trigger_level: Optional[str] = None
    trigger_value: Optional[float] = None
    workers_affected: int = 0
    total_payout: float = 0.0
    fraud_holds: int = 0
    fired_at: Optional[str] = None
    payout_status: Optional[str] = None


class MessageResponse(BaseModel):
    status: str
