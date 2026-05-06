from sqlalchemy import text
from datetime import date
import random

def update_forecast(db):
    zones = db.execute(text("""
        SELECT zone_id, rainfall, temperature, aqi
        FROM zone_live_cache
    """)).fetchall()

    for z in zones:
        # 🔥 SIMPLE LOGIC (replace later with ML)
        p_rain = min(1.0, z.rainfall / 10)
        p_heat = min(1.0, z.temperature / 50)
        p_aqi = min(1.0, z.aqi / 500)

        composite_risk = round((p_rain + p_heat + p_aqi) / 3, 2)

        if composite_risk > 0.6:
            label = "high"
        elif composite_risk > 0.4:
            label = "medium"
        else:
            label = "low"

        db.execute(text("""
            INSERT INTO weekly_forecast_cache (
                zone_id,
                forecast_date,
                p_rain,
                p_heat,
                p_aqi,
                composite_risk,
                risk_label,
                computed_at
            )
            VALUES (
                :zone_id,
                :forecast_date,
                :p_rain,
                :p_heat,
                :p_aqi,
                :composite_risk,
                :risk_label,
                NOW()
            )
        """), {
            "zone_id": z.zone_id,
            "forecast_date": date.today(),
            "p_rain": p_rain,
            "p_heat": p_heat,
            "p_aqi": p_aqi,
            "composite_risk": composite_risk,
            "risk_label": label
        })

    db.commit()

    return {"status": "forecast updated"}