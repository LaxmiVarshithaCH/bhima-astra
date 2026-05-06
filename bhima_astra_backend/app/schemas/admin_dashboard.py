from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


# ✅ KPI Response
class KPIResponse(BaseModel):
    active_policies: int
    payouts_today: float
    fraud_holds: int
    loss_ratio: float
    total_workers: int


# ✅ Heatmap Zone
class HeatmapZone(BaseModel):
    zone_id: str
    rainfall: float
    temperature: float
    aqi: int
    traffic_index: float
    composite_score: float
    updated_at: datetime


# ✅ Individual agent raw row (for the "agents" list in the response)
class AgentStatus(BaseModel):
    agent_name: str
    status: str
    last_run: Optional[datetime] = None


# ✅ Named per-agent blocks that the frontend CommandCenter reads
class MonitorAgentStatus(BaseModel):
    status: str
    zones_tracked: int
    last_poll_time: str


class TriggerAgentStatus(BaseModel):
    status: str
    triggers_today: int
    pipeline_latency: str


class FraudAgentStatus(BaseModel):
    status: str
    holds_active: int
    claims_processed: int


class PayoutAgentStatus(BaseModel):
    status: str
    failures: int
    payouts_processed: int


# ✅ Full agent status response — named keys + raw list
class AgentStatusResponse(BaseModel):
    monitor: MonitorAgentStatus
    trigger: TriggerAgentStatus
    fraud: FraudAgentStatus
    payout: PayoutAgentStatus
    agents: List[AgentStatus] = []
