from pydantic import BaseModel


class IncomeRequest(BaseModel):
    worker_id: int


class RiskRequest(BaseModel):
    worker_id: int


class PremiumRequest(BaseModel):
    worker_id: int


class PremiumResponse(BaseModel):
    risk_score: float
    predicted_income: float
    suggested_premium: float
    recommended_plan: str