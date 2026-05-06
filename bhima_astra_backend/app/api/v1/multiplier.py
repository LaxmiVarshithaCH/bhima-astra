"""
Multiplier Router
=================
Endpoints for viewing and updating payout multipliers per zone/city.

Routes
------
GET  /api/v1/admin/multiplier/suggest          – Suggest multipliers from live weather data
PUT  /api/v1/admin/multiplier/{city_name}      – Update multiplier in DB for a city
"""

import logging
from typing import List

from app.db.session import get_db
from app.schemas.multiplier import (
    MultiplierSuggestion,
    MultiplierUpdateRequest,
    MultiplierUpdateResponse,
)
from app.services.multiplier_service import suggest_multipliers, update_multiplier
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

logger = logging.getLogger("bhima.multiplier_router")

router = APIRouter(prefix="/api/v1/admin/multiplier", tags=["Admin Multiplier"])


# 💡 SUGGEST MULTIPLIERS BASED ON LIVE ZONE CONDITIONS
@router.get("/suggest", response_model=List[MultiplierSuggestion])
def get_multiplier_suggestions(db: Session = Depends(get_db)):
    """
    Suggest payout multipliers for each zone based on current environmental data
    pulled from zone_live_cache.

    **Adjustment logic (cumulative):**
    - ``composite_score > 0.7``  → +0.10 (high combined risk)
    - ``temperature > 40°C``     → +0.05 (heatwave alert)
    - ``aqi > 300``              → +0.05 (severe air quality)

    Base multiplier is read from the ``city_payout_multipliers`` table.
    Results are sorted with the highest suggested delta first.

    **Example response:**
    ```json
    [
        {
            "zone_id": "Andheri-W",
            "city_name": "Mumbai",
            "current_multiplier": 1.2,
            "suggested_multiplier": 1.35,
            "reason": "High composite risk score (0.82); Heavy rainfall L2 detected",
            "composite_score": 0.82
        }
    ]
    ```
    """
    try:
        return suggest_multipliers(db)
    except Exception as e:
        logger.error(f"[MULTIPLIER] suggest endpoint error: {e}")
        return []


# ✏️ UPDATE MULTIPLIER FOR A CITY
@router.put("/{city_name}", response_model=MultiplierUpdateResponse)
def put_multiplier(
    city_name: str,
    body: MultiplierUpdateRequest,
    db: Session = Depends(get_db),
):
    """
    Update the payout multiplier in ``city_payout_multipliers`` for *city_name*.

    Executes:
    ```sql
    UPDATE city_payout_multipliers
    SET multiplier = <new_value>
    WHERE city_name ILIKE '<city_name>'
    ```

    **Request body:**
    ```json
    { "multiplier": 1.35 }
    ```

    **Example response:**
    ```json
    {
        "city_name": "Mumbai",
        "old_multiplier": 1.2,
        "new_multiplier": 1.35,
        "updated_at": "2024-06-15T10:30:00.123456"
    }
    ```
    """
    try:
        return update_multiplier(db, city_name, body.multiplier)
    except Exception as e:
        logger.error(
            f"[MULTIPLIER] put_multiplier endpoint error for '{city_name}': {e}"
        )
        from datetime import datetime

        return MultiplierUpdateResponse(
            city_name=city_name,
            old_multiplier=1.0,
            new_multiplier=body.multiplier,
            updated_at=datetime.utcnow().isoformat(),
            error=str(e),
        )
