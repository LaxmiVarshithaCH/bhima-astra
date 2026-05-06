from pydantic import BaseModel
from datetime import date
from typing import List


class ZoneForecastItem(BaseModel):
    forecast_date: date
    p_rain: float
    p_heat: float
    p_aqi: float
    composite_risk: float
    risk_label: str


class ZoneForecastResponse(BaseModel):
    zone_id: str
    forecast: List[ZoneForecastItem]

from typing import List
from datetime import date


class ZoneHistoryItem(BaseModel):
    date: date
    avg_risk: float
    disruption_events: int
    avg_income_loss: float


class ZoneHistoryResponse(BaseModel):
    zone_id: str
    history: List[ZoneHistoryItem]