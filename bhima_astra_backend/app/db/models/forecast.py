from sqlalchemy import Column, Integer, Text, Float, Date, TIMESTAMP
from app.db.session import Base
from sqlalchemy.sql import func


class WeeklyForecastCache(Base):
    __tablename__ = "weekly_forecast_cache"

    forecast_id = Column(Integer, primary_key=True)

    zone_id = Column(Text)
    forecast_date = Column(Date)

    p_rain = Column(Float)
    p_heat = Column(Float)
    p_aqi = Column(Float)

    composite_risk = Column(Float)
    risk_label = Column(Text)

    computed_at = Column(TIMESTAMP, server_default=func.now())