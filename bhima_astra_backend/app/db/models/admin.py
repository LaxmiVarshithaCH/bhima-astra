from sqlalchemy import Column, Integer, Text, TIMESTAMP
from app.db.session import Base
from sqlalchemy.sql import func


class Admin(Base):
    __tablename__ = "admins"

    admin_id = Column(Integer, primary_key=True)
    admin_name = Column(Text)
    email = Column(Text, unique=True)
    password_hash = Column(Text)

    role = Column(Text)

    created_at = Column(TIMESTAMP, server_default=func.now())