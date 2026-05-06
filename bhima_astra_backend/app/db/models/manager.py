from sqlalchemy import Column, Integer, Text, ARRAY, TIMESTAMP, Float
from app.db.session import Base
from sqlalchemy.sql import func


class Manager(Base):
    __tablename__ = "managers"

    manager_id = Column(Integer, primary_key=True)
    manager_name = Column(Text)
    email = Column(Text, unique=True)
    password_hash = Column(Text)

    assigned_zones = Column(ARRAY(Text))

    # Dark store geo-coordinates (added via ALTER TABLE)
    dark_store_lat = Column(Float, nullable=True)
    dark_store_lng = Column(Float, nullable=True)
    dark_store_address = Column(Text, nullable=True)

    created_at = Column(TIMESTAMP, server_default=func.now())