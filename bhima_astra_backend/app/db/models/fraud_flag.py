from datetime import datetime

from app.db.session import Base
from sqlalchemy import TIMESTAMP, BigInteger, Boolean, Column, Float, Integer, Text


class FraudFlag(Base):
    __tablename__ = "fraud_flags"

    flag_id = Column(Integer, primary_key=True, index=True)

    claim_id = Column(BigInteger, index=True)
    worker_id = Column(Integer, index=True)

    fraud_score = Column(Float)
    fraud_flag = Column(Boolean, default=False)

    payout_action = Column(
        Text
    )  # release_full / release_partial / hold_48h / block_permanent

    fraud_reason = Column(Text)

    stage_breakdown = Column(Text)  # JSON string of per-stage scores

    detected_at = Column(TIMESTAMP, default=datetime.utcnow)

    review_status = Column(
        Text, default="pending_review"
    )  # pending_review / auto_processed / reviewed

    reviewed_by = Column(Integer, nullable=True)  # admin_id
    reviewed_at = Column(TIMESTAMP, nullable=True)

    review_notes = Column(Text, nullable=True)
