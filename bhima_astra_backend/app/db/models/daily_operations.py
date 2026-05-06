from sqlalchemy import Column, Integer, Float, Boolean, Date, Text
from app.db.session import Base


class DailyOperation(Base):
    __tablename__ = "daily_operations"

    log_id = Column(Integer, primary_key=True, index=True)

    worker_id = Column(Integer)

    date = Column(Date)
    day_of_week = Column(Integer)
    hour_of_day = Column(Integer)

    peak_hour_flag = Column(Boolean)
    weekend_flag = Column(Boolean)

    orders_per_day = Column(Integer)
    orders_per_hour = Column(Float)
    delivery_distance_km = Column(Float)

    earnings_per_order = Column(Float)
    base_pay = Column(Float)
    surge_multiplier = Column(Float)
    incentive_bonus = Column(Float)
    tip_amount = Column(Float)

    expected_income = Column(Float)
    actual_income = Column(Float)
    daily_income = Column(Float)
    income_loss = Column(Float)

    weekly_income = Column(Float)
    monthly_income = Column(Float)

    rolling_avg_income_7d = Column(Float)
    rolling_orders_3d = Column(Float)

    days_since_last_active = Column(Integer)

    rainfall = Column(Float)
    rainfall_category = Column(Text)
    temperature = Column(Float)
    heat_index = Column(Float)

    aqi = Column(Integer)
    aqi_category = Column(Text)

    traffic_index = Column(Float)
    flood_alert = Column(Boolean)

    wind_speed = Column(Float)
    visibility = Column(Text)

    road_closure_flag = Column(Boolean)

    r_norm = Column(Float)
    aqi_norm = Column(Float)
    traffic_norm = Column(Float)

    composite_score = Column(Float)
    composite_threshold = Column(Float)

    platform_outage = Column(Boolean)
    zone_shutdown = Column(Boolean)
    curfew_flag = Column(Boolean)
    strike_flag = Column(Boolean)

    order_demand_drop_pct = Column(Float)
    supply_constraint = Column(Float)
    delivery_delay_min = Column(Float)

    disruption_flag = Column(Boolean)

    sudden_income_spike = Column(Boolean)
    location_jump_flag = Column(Boolean)
    device_switch_count = Column(Integer)
    cancelled_orders_ratio = Column(Float)