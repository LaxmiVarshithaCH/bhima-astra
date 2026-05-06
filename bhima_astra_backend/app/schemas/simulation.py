from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel


# ✅ Simulation Request Body
class SimulationRequest(BaseModel):
    zone_id: str
    trigger_type: str
    trigger_value: float
    trigger_level: str


# ✅ Individual worker entry in simulation response
class SimulationWorker(BaseModel):
    worker_id: int
    worker_id_str: str
    worker_name: str
    geo_zone_id: str
    fraud_risk_score: float

    model_config = {"extra": "allow"}


# ✅ Simulation Trigger Response
class SimulationResponse(BaseModel):
    simulation_id: str
    zone_id: str
    trigger_type: str
    trigger_value: float
    trigger_level: str
    workers_triggered: int
    status: str
    celery_task_ids: List[str]
    created_at: str
    # Real worker list returned so the frontend can display them immediately
    workers: List[SimulationWorker] = []

    model_config = {"extra": "allow"}


# ✅ Simulation Status Response
class SimulationStatusResponse(BaseModel):
    simulation_id: str
    status: str
    zone_id: Optional[str] = None
    workers_triggered: int = 0
    celery_task_ids: List[str] = []
    created_at: Optional[str] = None
