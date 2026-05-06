from sqlalchemy import Column, Integer, Float, Text, TIMESTAMP
from app.db.session import Base
from sqlalchemy.sql import func


class PayoutTransaction(Base):
    __tablename__ = "payout_transactions"

    transaction_id = Column(Integer, primary_key=True)

    claim_id = Column(Integer)
    worker_id = Column(Integer)

    amount = Column(Float)
    status = Column(Text)

    payment_reference = Column(Text)
    failure_reason = Column(Text)

    created_at = Column(TIMESTAMP, server_default=func.now())