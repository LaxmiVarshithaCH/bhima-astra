from sqlalchemy import Column, Integer, Text, Float, Boolean, String
from app.db.session import Base


class Worker(Base):
    __tablename__ = "workers"

    worker_id = Column(Integer, primary_key=True, index=True)

    worker_name = Column(Text)
    platform = Column(Text)
    city = Column(Text)
    geo_zone_id = Column(Text)

    vehicle_type = Column(Text)
    shift_hours = Column(Float)
    experience_level = Column(Float)
    employment_type = Column(Text)

    upi_id = Column(Text)
    bank_ifsc = Column(Text)

    device_id = Column(Text)

    kyc_verified = Column(Boolean)
    bank_verified = Column(Boolean)

    fraud_risk_score = Column(Float)
    payment_verified_status = Column(Text)

    phone_number = Column(String(20), unique=True, index=True)