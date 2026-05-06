from typing import Any, Dict, List, Optional, Union

from pydantic import BaseModel


# ✅ SHAP Feature explanation entry
class SHAPFeature(BaseModel):
    feature_name: str
    shap_value: float
    contribution: str


# ✅ Full fraud analysis response (POST /fraud/analyze/{claim_id})
class FraudAnalyzeResponse(BaseModel):
    claim_id: int
    fraud_score: float
    fraud_flag: bool
    fraud_reason: Union[List[str], str]
    stage_reached: str
    payout_action: str
    shap_explanation: List[SHAPFeature] = []
    stage_breakdown: Dict[str, Any] = {}
    processing_time_ms: float
    analyzed_at: str
    error: Optional[str] = None


# ✅ Single item in the live fraud feed
class FraudLiveItem(BaseModel):
    claim_id: int
    fraud_score: float
    fraud_flag: bool
    fraud_reason: Union[List[str], str]
    stage_reached: str
    payout_action: str
    analyzed_at: str
    error: Optional[str] = None
