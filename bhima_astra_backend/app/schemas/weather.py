from typing import List, Optional

from pydantic import BaseModel


# ✅ Single city weather response
class WeatherResponse(BaseModel):
    city: str
    rainfall_mm: float
    temperature_c: float
    humidity: int
    aqi: int
    weather_description: str
    flood_flag: bool
    heatwave_flag: bool
    source: str


# ✅ All zones weather response wrapper
class ZoneWeatherList(BaseModel):
    zones: List[WeatherResponse]
    total: int
