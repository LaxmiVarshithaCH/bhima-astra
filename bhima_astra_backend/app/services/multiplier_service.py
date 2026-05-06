"""
Multiplier Service
==================
Suggests and updates payout multipliers for zones based on live weather/risk data.

Logic:
  - Base multiplier fetched from city_payout_multipliers table
  - composite_score > 0.7  → suggested_multiplier += 0.10
  - temperature > 40°C     → suggested_multiplier += 0.05
  - aqi > 300              → suggested_multiplier += 0.05
  - Rainfall level label   → appended to human-readable reason string
"""

import logging
import random
from datetime import datetime
from typing import Any, Dict, List

from sqlalchemy import text
from sqlalchemy.orm import Session

logger = logging.getLogger("bhima.multiplier_service")


# ---------------------------------------------------------------------------
# ZONE → CITY MAPPING
# Maps geo zone names stored in zone_live_cache to city names used in
# city_payout_multipliers so lookups resolve correctly.
# ---------------------------------------------------------------------------

ZONE_TO_CITY: Dict[str, str] = {
    "Vasant Kunj": "Delhi",
    "Mehdipatnam": "Hyderabad",
    "Dadar": "Mumbai",
    "Sanganer": "Jaipur",
    "Andheri-W": "Mumbai",
    "Dilsukhnagar": "Hyderabad",
    "Marathahalli": "Bangalore",
    "Shivajinagar": "Pune",
}


# ---------------------------------------------------------------------------
# SUGGEST MULTIPLIERS
# ---------------------------------------------------------------------------


def suggest_multipliers(db: Session) -> List[Dict[str, Any]]:
    """
    For every zone in zone_live_cache, compute a suggested payout multiplier
    based on current environmental conditions (with live randomization to
    simulate real-time sensor drift) and return a ranked list.

    Returns
    -------
    list of dicts  –  one entry per zone
        zone_id, city_name, current_multiplier, suggested_multiplier,
        reason, composite_score
    """
    # ── 1. Load all live zone rows ──────────────────────────────────────────
    try:
        zone_rows = db.execute(
            text("""
                SELECT zone_id, rainfall, temperature, aqi, composite_score
                FROM zone_live_cache
            """)
        ).fetchall()
    except Exception as db_err:
        logger.error(f"[MULTIPLIER] Zone cache fetch error: {db_err}")
        zone_rows = []

    suggestions = []

    for zone in zone_rows:
        zone_id = zone.zone_id

        # ── 2. Add fresh random variation to simulate live sensor readings ──
        base_rainfall = float(zone.rainfall or 0.0)
        base_temp = float(zone.temperature or 30.0)
        base_aqi = int(zone.aqi or 100)

        rainfall = base_rainfall + random.uniform(-5, 20)
        temperature = base_temp + random.uniform(-2, 3)
        aqi = base_aqi + random.randint(-30, 50)

        # Clamp to physically reasonable lower bounds
        rainfall = max(0.0, rainfall)
        temperature = max(15.0, temperature)
        aqi = max(0, aqi)

        # ── 3. Recompute composite_score from randomised readings ────────────
        composite_score = min(
            1.0,
            (rainfall / 300) * 0.5
            + (aqi / 500) * 0.3
            + max(0.0, (temperature - 25) / 25) * 0.2,
        )

        # ── 4. Resolve city from zone via ZONE_TO_CITY mapping ──────────────
        city_lookup = ZONE_TO_CITY.get(zone_id, zone_id)

        # ── 5. Base multiplier from city_payout_multipliers ─────────────────
        current_multiplier = 1.0
        city_name = city_lookup  # fallback label

        try:
            mult_row = db.execute(
                text("""
                    SELECT city_name, multiplier
                    FROM city_payout_multipliers
                    WHERE city_name ILIKE :pattern
                    ORDER BY effective_from DESC
                    LIMIT 1
                """),
                {"pattern": f"%{city_lookup}%"},
            ).fetchone()

            if mult_row:
                current_multiplier = float(mult_row.multiplier or 1.0)
                city_name = mult_row.city_name
        except Exception as mult_err:
            logger.warning(
                f"[MULTIPLIER] Multiplier fetch error for zone '{zone_id}' "
                f"(city='{city_lookup}'): {mult_err}"
            )

        # ── 6. Compute suggested multiplier using thresholds ─────────────────
        suggested_multiplier = current_multiplier
        reasons: List[str] = []

        if composite_score > 0.7:
            suggested_multiplier += 0.10
            reasons.append(f"High composite risk score ({composite_score:.2f})")

        if temperature > 40.0:
            suggested_multiplier += 0.05
            reasons.append(f"Heatwave alert (temp={temperature:.1f}°C)")

        if aqi > 300:
            suggested_multiplier += 0.05
            reasons.append(f"Severe AQI level ({aqi})")

        # Rainfall descriptive label (no extra bump – already captured in composite)
        if rainfall > 80.0:
            reasons.append(f"Heavy rainfall L2 detected ({rainfall:.1f} mm)")
        elif rainfall > 40.0:
            reasons.append(f"Moderate rainfall L1 detected ({rainfall:.1f} mm)")

        reason = (
            "; ".join(reasons)
            if reasons
            else "Conditions nominal – no adjustment needed"
        )

        suggestions.append(
            {
                "zone_id": zone_id,
                "city_name": city_name,
                "current_multiplier": round(current_multiplier, 3),
                "suggested_multiplier": round(suggested_multiplier, 3),
                "reason": reason,
                "composite_score": round(composite_score, 3),
                # Expose the live-randomised readings for transparency
                "live_rainfall": round(rainfall, 1),
                "live_temperature": round(temperature, 1),
                "live_aqi": aqi,
            }
        )

    # Sort: zones with highest delta first so the dashboard highlights top risks
    suggestions.sort(
        key=lambda x: x["suggested_multiplier"] - x["current_multiplier"],
        reverse=True,
    )

    return suggestions


# ---------------------------------------------------------------------------
# UPDATE MULTIPLIER
# ---------------------------------------------------------------------------


def update_multiplier(
    db: Session, city_name: str, new_multiplier: float
) -> Dict[str, Any]:
    """
    Update the payout multiplier in city_payout_multipliers for *city_name*.

    Parameters
    ----------
    db            : SQLAlchemy session
    city_name     : City name to match (case-insensitive, partial match)
    new_multiplier: Replacement multiplier value

    Returns
    -------
    dict with city_name, old_multiplier, new_multiplier, updated_at
    (plus optional "error" key if the DB update failed)
    """
    updated_at = datetime.utcnow().isoformat()

    try:
        # Read current value first so we can return it in the response
        row = db.execute(
            text("""
                SELECT city_name, multiplier
                FROM city_payout_multipliers
                WHERE city_name ILIKE :city_name
                ORDER BY effective_from DESC
                LIMIT 1
            """),
            {"city_name": city_name},
        ).fetchone()

        old_multiplier = float(row.multiplier) if row else 1.0
        # Use the exact DB city_name if found (preserves casing)
        canonical_city = row.city_name if row else city_name

        db.execute(
            text("""
                UPDATE city_payout_multipliers
                SET multiplier = :new_multiplier
                WHERE city_name ILIKE :city_name
            """),
            {"new_multiplier": new_multiplier, "city_name": city_name},
        )
        db.commit()

        logger.info(
            f"[MULTIPLIER] Updated '{canonical_city}': "
            f"{old_multiplier} → {new_multiplier}"
        )

        return {
            "city_name": canonical_city,
            "old_multiplier": old_multiplier,
            "new_multiplier": new_multiplier,
            "updated_at": updated_at,
        }

    except Exception as e:
        logger.error(f"[MULTIPLIER] Update failed for '{city_name}': {e}")
        try:
            db.rollback()
        except Exception:
            pass

        return {
            "city_name": city_name,
            "old_multiplier": 1.0,
            "new_multiplier": new_multiplier,
            "updated_at": updated_at,
            "error": str(e),
        }
