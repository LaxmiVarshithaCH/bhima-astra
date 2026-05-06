from typing import List, Optional

from pydantic import BaseModel


# ✅ Suggestion item returned for each zone
class MultiplierSuggestion(BaseModel):
    zone_id: str
    city_name: str
    current_multiplier: float
    suggested_multiplier: float
    reason: str
    composite_score: float


# ✅ Request body for PUT /multiplier/{city_name}
class MultiplierUpdateRequest(BaseModel):
    multiplier: float


# ✅ Response after updating a multiplier
class MultiplierUpdateResponse(BaseModel):
    city_name: str
    old_multiplier: float
    new_multiplier: float
    updated_at: str
    error: Optional[str] = None
