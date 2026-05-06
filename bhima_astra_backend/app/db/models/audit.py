from sqlalchemy import Column, Integer, Text, TIMESTAMP, JSON
from app.db.session import Base
from sqlalchemy.sql import func


class AuditLog(Base):
    __tablename__ = "audit_log"

    log_id = Column(Integer, primary_key=True)

    agent_name = Column(Text)
    action = Column(Text)

    entity_type = Column(Text)
    entity_id = Column(Integer)

    payload = Column(JSON)

    shap_explanation = Column(Text)

    performed_by = Column(Integer)

    created_at = Column(TIMESTAMP, server_default=func.now())