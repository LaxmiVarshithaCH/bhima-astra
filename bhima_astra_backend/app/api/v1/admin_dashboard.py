from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List

from app.db.session import get_db
from app.services.admin_dashboard_service import (
    get_kpis,
    get_heatmap,
    get_agent_status
)
from app.schemas.admin_dashboard import (
    KPIResponse,
    HeatmapZone,
    AgentStatusResponse
)

router = APIRouter(prefix="/api/v1/admin/dashboard", tags=["Admin Dashboard"])


# 🔥 KPI CARDS
@router.get("/kpis", response_model=KPIResponse)
def fetch_kpis(db: Session = Depends(get_db)):
    return get_kpis(db)


# 🔥 HEATMAP
@router.get("/heatmap", response_model=List[HeatmapZone])
def fetch_heatmap(db: Session = Depends(get_db)):
    return get_heatmap(db)


# 🔥 AGENT STATUS
@router.get("/agents", response_model=AgentStatusResponse)
def fetch_agents(db: Session = Depends(get_db)):
    return get_agent_status(db)