from app.db.session import Base
from sqlalchemy import TIMESTAMP, Boolean, Column, Float, Integer, Text
from sqlalchemy.sql import func


class ManagerDisruptionFlag(Base):
    __tablename__ = "manager_disruption_flags"

    flag_id = Column(Integer, primary_key=True)

    manager_id = Column(Integer)

    zone_id = Column(Text)
    disruption_type = Column(Text)

    description = Column(Text)

    estimated_start = Column(TIMESTAMP)
    estimated_end = Column(TIMESTAMP)

    route_feasible = Column(Boolean)

    workers_in_zone = Column(Integer)
    estimated_payout = Column(Float)

    flag_status = Column(Text)

    admin_verified = Column(Boolean)
    verified_by = Column(Integer)
    verified_at = Column(TIMESTAMP)
    payout_enabled = Column(Boolean)

    created_at = Column(TIMESTAMP, server_default=func.now())
