"""
Weather Router
==============
Exposes real-time weather and AQI data for individual cities and all
zones tracked in zone_live_cache.

Routes
------
GET /api/v1/admin/weather/zones/all   – Weather for every zone in DB
GET /api/v1/admin/weather/{city}      – Weather for a single city

NOTE: /zones/all is defined BEFORE /{city} so FastAPI does not swallow
      the literal path segment "zones" as a city path parameter.
"""

import logging
from typing import Any, Dict, List

from app.db.session import get_db
from app.schemas.weather import WeatherResponse, ZoneWeatherList
from app.services.weather_service import get_all_zones_weather, get_city_weather
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

logger = logging.getLogger("bhima.weather_router")

router = APIRouter(prefix="/api/v1/admin/weather", tags=["Admin Weather"])


# 🌍 ALL ZONES WEATHER
# Must be registered before /{city} to prevent "zones" being matched as a city name.
@router.get("/zones/all")
def fetch_all_zones_weather(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """
    Fetch real-time weather (OpenWeatherMap) and AQI (WAQI) for **every zone**
    that exists in zone_live_cache.

    Returns a JSON object with:
    - ``zones``  – list of WeatherResponse objects (one per zone)
    - ``total``  – count of zones returned

    Always succeeds: falls back to a hardcoded set of known zone IDs if the
    DB query fails, and returns sensible defaults per zone if the external
    weather APIs are unreachable.
    """
    try:
        results: List[Dict[str, Any]] = get_all_zones_weather(db)
        return {"zones": results, "total": len(results)}
    except Exception as exc:
        logger.error(f"[WEATHER ROUTER] fetch_all_zones_weather error: {exc}")
        return {"zones": [], "total": 0}


# 🌦 SINGLE CITY WEATHER
@router.get("/{city}", response_model=WeatherResponse)
def fetch_city_weather(city: str) -> Dict[str, Any]:
    """
    Fetch real-time weather data for a **single city or zone ID**.

    Data sources:
    - **OpenWeatherMap** → temperature, humidity, rainfall, description
    - **WAQI**           → AQI index

    Derived fields:
    - ``flood_flag``    – True when rainfall_mm > 80
    - ``heatwave_flag`` – True when temperature_c > 40

    Always returns a valid response. If both external APIs fail the
    returned values are sensible defaults (temp=30°C, AQI=100, rain=0mm).
    """
    try:
        return get_city_weather(city)
    except Exception as exc:
        logger.error(f"[WEATHER ROUTER] fetch_city_weather error for '{city}': {exc}")
        # Ultimate fallback – should never be reached because get_city_weather
        # already handles all its own exceptions internally.
        return {
            "city": city,
            "rainfall_mm": 0.0,
            "temperature_c": 30.0,
            "humidity": 60,
            "aqi": 100,
            "weather_description": "data unavailable",
            "flood_flag": False,
            "heatwave_flag": False,
            "source": "fallback",
        }
