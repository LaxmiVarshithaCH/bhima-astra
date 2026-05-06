from app.db.session import Base
from sqlalchemy import (
    TIMESTAMP,
    BigInteger,
    Boolean,
    Column,
    Date,
    Float,
    Integer,
    Text,
)


class PolicyClaim(Base):
    __tablename__ = "policy_claims"

    claim_id = Column(BigInteger, primary_key=True, autoincrement=True, index=True)

    worker_id = Column(Integer)
    policy_id = Column(BigInteger)

    plan_tier = Column(Text)
    weekly_premium = Column(Float)
    payout_l1 = Column(Float)   # ML-computed payout at L1 severity
    payout_l2 = Column(Float)   # ML-computed payout at L2 severity
    payout_l3 = Column(Float)   # ML-computed payout at L3 severity

    activation_date = Column(Date)
    last_active_date = Column(Date)

    policy_status = Column(Text)
    eligibility_flag = Column(Boolean)

    events_used = Column(Integer)
    events_remaining = Column(Integer)
    renewal_count = Column(Integer)

    trigger_type = Column(Text)
    trigger_level = Column(Text)
    trigger_value = Column(Float)

    claim_timestamp = Column(TIMESTAMP)
    claim_auto_created = Column(Boolean)

    claim_valid_flag = Column(Boolean)

    payout_status = Column(Text)
    payout_timestamp = Column(TIMESTAMP)
    payout_amount = Column(Float)

    income_loss = Column(Float)

    gps_lat = Column(Float)
    gps_lng = Column(Float)
    cell_tower_id = Column(Text)
    gps_tower_delta = Column(Float)

    accelerometer_variance = Column(Float)
    claim_response_time_sec = Column(Float)
    app_interaction_count = Column(Integer)

    fraud_score = Column(Float)
    fraud_flag = Column(Boolean)
    fraud_reason = Column(Text)

    trigger_evidence = Column(Text)
    claim_id_str = Column(Text)
