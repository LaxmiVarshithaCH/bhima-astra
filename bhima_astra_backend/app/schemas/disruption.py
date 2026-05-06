from datetime import datetime
from typing import List, Optional, Union

from pydantic import BaseModel, Field


class EnvironmentalDisruption(BaseModel):
    """Environmental disruption data from zone_live_cache"""

    model_config = {"from_attributes": True}

    zone_id: str
    disruption_type: str = Field(..., description="Type: rainfall | heat | aqi | flood")
    rainfall_mm: Optional[float] = Field(None, description="Rainfall in mm")
    temperature_celsius: Optional[float] = Field(None, description="Temperature in °C")
    aqi_value: Optional[int] = Field(None, description="Air Quality Index (0-500)")
    severity_level: Optional[str] = Field(None, description="L1 | L2 | L3")
    composite_score: Optional[float] = Field(
        None, ge=0, le=1, description="CDS score [0-1]"
    )
    timestamp: datetime
    workers_affected: Optional[int] = None
    estimated_income_loss: Optional[float] = None


class ManagerDisruptionFlag(BaseModel):
    """Manager-reported disruption flag"""

    model_config = {"from_attributes": True}

    flag_id: int
    manager_id: int
    zone_id: str
    disruption_type: str
    description: Optional[str] = None
    estimated_start: Optional[datetime] = None
    estimated_end: Optional[datetime] = None
    route_feasible: Optional[bool] = None
    workers_in_zone: Optional[int] = None
    estimated_payout: Optional[float] = None
    flag_status: str = Field(
        ..., description="pending | verified | rejected | resolved"
    )
    admin_verified: Optional[bool] = None
    verified_by: Optional[int] = None
    verified_at: Optional[datetime] = None
    payout_enabled: Optional[bool] = None
    created_at: Optional[datetime] = None


class CombinedDisruptionItem(BaseModel):
    """Combined disruption item (environmental or manager flag)"""

    model_config = {"from_attributes": True}

    disruption_id: Union[str, int]  # zone_id for environmental, flag_id for manager
    type: str = Field(..., description="environmental | manager_flag")
    zone_id: str
    disruption_type: str
    description: Optional[str] = None
    severity_level: Optional[str] = None
    status: Optional[str] = None  # For manager flags
    timestamp: datetime
    workers_affected: Optional[int] = None
    estimated_payout: Optional[float] = None

    # Detailed data (filled based on type)
    environmental_data: Optional[EnvironmentalDisruption] = None
    manager_flag_data: Optional[ManagerDisruptionFlag] = None


class DisruptionListResponse(BaseModel):
    """Paginated list of combined disruptions"""

    total: int
    environmental_count: int
    manager_flags_count: int
    items: List[CombinedDisruptionItem]


class ManagerFlagUpdateRequest(BaseModel):
    """Request to update manager disruption flag"""

    action: str = Field(..., description="verify | reject")
    admin_id: int
    notes: Optional[str] = None
    payout_enabled: Optional[bool] = None


class ManagerFlagUpdateResponse(BaseModel):
    """Response after updating manager flag"""

    model_config = {"from_attributes": True}

    flag_id: int
    zone_id: str
    disruption_type: str
    flag_status: str
    admin_verified: bool
    verified_by: Optional[int] = None
    verified_at: Optional[datetime] = None
    payout_enabled: Optional[bool] = None
    message: str


class DisruptionDetailResponse(BaseModel):
    """Detailed view of a single disruption"""

    model_config = {"from_attributes": True}

    disruption_id: Union[str, int]
    type: str  # environmental | manager_flag
    zone_id: str
    disruption_type: str
    description: Optional[str] = None

    # Environmental specifics
    environmental_metrics: Optional[dict] = None

    # Manager flag specifics
    manager_details: Optional[ManagerDisruptionFlag] = None

    # Impact analysis
    workers_affected: Optional[int] = None
    estimated_income_loss: Optional[float] = None
    estimated_payout: Optional[float] = None

    # Timeline
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    # Status tracking
    status: Optional[str] = None
    verified_by: Optional[int] = None
    verified_at: Optional[datetime] = None
