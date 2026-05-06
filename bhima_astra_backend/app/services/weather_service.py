"""
Weather Service
===============
Fetches real-time weather from OpenWeatherMap and AQI from WAQI.
Always returns a valid response — falls back to sensible defaults if either
external API is unavailable (network error, bad status, timeout, etc.).

External APIs
-------------
OWM  : https://api.openweathermap.org/data/2.5/weather?q={city}&appid=...&units=metric
WAQI : https://api.waqi.info/feed/{city}/?token=...
"""

import logging
import os
from typing import Any, Dict, List

import httpx
from sqlalchemy import text
from sqlalchemy.orm import Session

logger = logging.getLogger("bhima.weather_service")

# ---------------------------------------------------------------------------
# API credentials (non-secret demo keys — rotate in production via env vars)
# ---------------------------------------------------------------------------
OWM_API_KEY = os.getenv("WEATHER_API_KEY", "")
WAQI_TOKEN = os.getenv("WAQI_TOKEN", "")

# HTTP client timeout (seconds) — kept short so the API never blocks the UI
HTTP_TIMEOUT = 8.0

# Thresholds for derived flags
FLOOD_RAINFALL_THRESHOLD_MM = 80.0
HEATWAVE_TEMP_THRESHOLD_C = 40.0


# ---------------------------------------------------------------------------
# URL builders
# ---------------------------------------------------------------------------


def _owm_url(city: str) -> str:
    return (
        f"https://api.openweathermap.org/data/2.5/weather"
        f"?q={city}&appid={OWM_API_KEY}&units=metric"
    )


def _waqi_url(city: str) -> str:
    return f"https://api.waqi.info/feed/{city}/?token={WAQI_TOKEN}"


# ---------------------------------------------------------------------------
# Response parsers
# ---------------------------------------------------------------------------


def _parse_owm(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Extract temperature, humidity, rainfall, and description from an
    OpenWeatherMap /weather JSON payload.
    """
    main = data.get("main", {})
    weather_list = data.get("weather", [{}])
    weather_desc = (
        weather_list[0].get("description", "clear sky") if weather_list else "clear sky"
    )

    rain = data.get("rain", {})
    # OWM reports rain as 1h or 3h bucket — prefer 1h, fall back to 3h, then 0
    rainfall_mm = float(rain.get("1h", rain.get("3h", 0.0)))

    return {
        "temperature_c": float(main.get("temp", 30.0)),
        "humidity": int(main.get("humidity", 60)),
        "rainfall_mm": rainfall_mm,
        "weather_description": weather_desc,
    }


def _parse_waqi(data: Dict[str, Any]) -> int:
    """
    Extract integer AQI value from a WAQI API JSON payload.
    Returns 100 (moderate) as a safe default on any parsing failure.
    """
    try:
        if data.get("status") == "ok":
            aqi_raw = data.get("data", {}).get("aqi", 100)
            return int(aqi_raw)
    except Exception:
        pass
    return 100


# ---------------------------------------------------------------------------
# Public service functions
# ---------------------------------------------------------------------------


def get_city_weather(city: str) -> Dict[str, Any]:
    """
    Fetch real-time weather data for *city*.

    Combines:
    - OpenWeatherMap  → temperature, humidity, rainfall, description
    - WAQI            → AQI index

    Always returns a fully populated dict even if both external calls fail
    (fallback values are clearly logged as warnings, not errors).

    Parameters
    ----------
    city : str
        City name or zone identifier (e.g. "Mumbai", "Andheri-W").

    Returns
    -------
    dict
        Keys: city, rainfall_mm, temperature_c, humidity, aqi,
              weather_description, flood_flag, heatwave_flag, source.
    """
    # Safe defaults
    temperature_c: float = 30.0
    humidity: int = 60
    rainfall_mm: float = 0.0
    weather_description: str = "clear sky"
    aqi: int = 100

    # ── OpenWeatherMap ──────────────────────────────────────────────────────
    try:
        with httpx.Client(timeout=HTTP_TIMEOUT) as client:
            resp = client.get(_owm_url(city))
            if resp.status_code == 200:
                parsed = _parse_owm(resp.json())
                temperature_c = parsed["temperature_c"]
                humidity = parsed["humidity"]
                rainfall_mm = parsed["rainfall_mm"]
                weather_description = parsed["weather_description"]
                logger.debug(f"[WEATHER] OWM success for '{city}': {parsed}")
            else:
                logger.warning(
                    f"[WEATHER] OWM returned HTTP {resp.status_code} for city='{city}' "
                    f"— using defaults"
                )
    except httpx.TimeoutException:
        logger.warning(
            f"[WEATHER] OWM request timed out for city='{city}' — using defaults"
        )
    except Exception as owm_err:
        logger.warning(
            f"[WEATHER] OWM fetch failed for city='{city}': {owm_err} — using defaults"
        )

    # ── WAQI AQI ────────────────────────────────────────────────────────────
    try:
        with httpx.Client(timeout=HTTP_TIMEOUT) as client:
            resp = client.get(_waqi_url(city))
            if resp.status_code == 200:
                aqi = _parse_waqi(resp.json())
                logger.debug(f"[WEATHER] WAQI success for '{city}': aqi={aqi}")
            else:
                logger.warning(
                    f"[WEATHER] WAQI returned HTTP {resp.status_code} for city='{city}' "
                    f"— using default AQI=100"
                )
    except httpx.TimeoutException:
        logger.warning(
            f"[WEATHER] WAQI request timed out for city='{city}' — using default AQI=100"
        )
    except Exception as waqi_err:
        logger.warning(
            f"[WEATHER] WAQI fetch failed for city='{city}': {waqi_err} — using default AQI=100"
        )

    # ── Derived boolean flags ───────────────────────────────────────────────
    flood_flag = rainfall_mm > FLOOD_RAINFALL_THRESHOLD_MM
    heatwave_flag = temperature_c > HEATWAVE_TEMP_THRESHOLD_C

    return {
        "city": city,
        "rainfall_mm": round(rainfall_mm, 2),
        "temperature_c": round(temperature_c, 2),
        "humidity": humidity,
        "aqi": aqi,
        "weather_description": weather_description,
        "flood_flag": flood_flag,
        "heatwave_flag": heatwave_flag,
        "source": "openweathermap",
    }


def get_all_zones_weather(db: Session) -> List[Dict[str, Any]]:
    """
    Fetch weather for every zone present in *zone_live_cache*.

    Falls back to a known set of zone IDs if the DB query fails so the
    endpoint is never completely empty.

    Parameters
    ----------
    db : Session
        SQLAlchemy DB session (injected by FastAPI dependency).

    Returns
    -------
    list[dict]
        One WeatherResponse-compatible dict per zone.
    """
    FALLBACK_ZONES = ["Vasant Kunj", "Mehdipatnam", "Andheri-W", "Dilsukhnagar"]

    try:
        rows = db.execute(
            text("SELECT DISTINCT zone_id FROM zone_live_cache ORDER BY zone_id")
        ).fetchall()
        zone_ids = [r.zone_id for r in rows] if rows else FALLBACK_ZONES
    except Exception as db_err:
        logger.error(
            f"[WEATHER] DB fetch for zone_live_cache failed: {db_err} — using fallback zones"
        )
        zone_ids = FALLBACK_ZONES

    if not zone_ids:
        zone_ids = FALLBACK_ZONES

    results: List[Dict[str, Any]] = []
    for zone_id in zone_ids:
        try:
            weather = get_city_weather(zone_id)
            results.append(weather)
        except Exception as zone_err:
            # Should never happen (get_city_weather never raises), but be safe
            logger.error(f"[WEATHER] Unexpected error for zone '{zone_id}': {zone_err}")
            results.append(
                {
                    "city": zone_id,
                    "rainfall_mm": 0.0,
                    "temperature_c": 30.0,
                    "humidity": 60,
                    "aqi": 100,
                    "weather_description": "data unavailable",
                    "flood_flag": False,
                    "heatwave_flag": False,
                    "source": "fallback",
                }
            )

    logger.info(f"[WEATHER] Fetched weather for {len(results)} zones")
    return results
