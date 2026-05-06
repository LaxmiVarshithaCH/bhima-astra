from pydantic import BaseModel


class PolicyActivateRequest(BaseModel):
    plan_tier: str  # Basic / Standard / Premium


class PolicyResponse(BaseModel):
    policy_id: int
    plan_tier: str
    weekly_premium: float
    policy_status: str
    events_remaining: int