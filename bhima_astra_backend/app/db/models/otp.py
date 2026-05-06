from sqlalchemy import Column, Integer, Text, Boolean, TIMESTAMP
from app.db.session import Base
from sqlalchemy.sql import func


class OTPToken(Base):
    __tablename__ = "otp_tokens"

    otp_id = Column(Integer, primary_key=True)

    phone_number = Column(Text)
    otp_code = Column(Text)

    expires_at = Column(TIMESTAMP)
    is_used = Column(Boolean)

    created_at = Column(TIMESTAMP, server_default=func.now())