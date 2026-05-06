import pandas as pd


# ---------------------------
# Load merged datasets
# ---------------------------
def load_feature_data():
    income_df = pd.read_csv("data/features/income.csv")
    disruption_df = pd.read_csv("data/features/disruption.csv")
    fraud_df = pd.read_csv("data/features/fraud.csv")

    return income_df, disruption_df, fraud_df


# ---------------------------
# Income Model
# ---------------------------
def build_income_features(df):
    target = "expected_income"

    # ✅ REPLACE WITH
    drop_cols = [
        "log_id", "date", "worker_id",
        "expected_income",
        "actual_income",
        "daily_income",
        "income_loss",
        "weekly_income",
        "monthly_income",
        "order_demand_drop_pct",
        "supply_constraint",
        "delivery_delay_min",
        "earnings_per_order",     # = actual_income / orders (circular)
        "base_pay",               # = earnings_per_order × 0.70 (derived)
        "rolling_avg_income_7d",  # = lag of actual_income (leaky for expected)
    ]

    features = [c for c in df.columns if c not in drop_cols]

    X = df[features].select_dtypes(include=["number"]).fillna(0)
    y = df[target]

    return X, y


# ---------------------------
# Disruption Model
# ---------------------------
def build_disruption_features(df):
    """
    Disruption prediction using ONLY predictive context signals.
    
    KEY PRINCIPLE: We drop ALL same-day trigger variables
    (rainfall, AQI, temperature, flood_alert, etc.) because
    disruption_flag IS mathematically defined by those exact values.
    
    Instead we use: worker profile, temporal patterns, zone risk,
    and rolling behavioral history — things available BEFORE
    the disruption occurs.
    """
    target = "disruption_flag"

    # ── Drop the target ──────────────────────────────────────
    # Drop ALL same-day environmental triggers (these DEFINE the flag)
    # Drop ALL derived/normalized versions of those triggers
    # Drop ALL post-disruption outcomes

    drop_cols = [
        # Target
        "disruption_flag",

        # System IDs
        "log_id", "date", "worker_id",

        # ── SAME-DAY TRIGGER VARIABLES ──
        # These directly define disruption_flag — keeping them
        # is equivalent to giving the model the answer
        "rainfall",
        "temperature",
        "AQI",
        "heat_index",           # derived from temperature
        "flood_alert",          # binary component of disruption_flag
        "platform_outage",      # binary component of disruption_flag
        "zone_shutdown",        # binary component of disruption_flag
        "curfew_flag",          # binary component of disruption_flag
        "strike_flag",          # binary component of disruption_flag
        "wind_speed",           # same-day measurement
        "road_closure_flag",    # consequence of flood_alert

        # ── NORMALIZED TRIGGER PROXIES ──
        "R_norm",               # = rainfall / 204.5
        "AQI_norm",             # = AQI / 500
        "Traffic_norm",         # = traffic_index / 100
        "composite_score",      # weighted combo of all triggers
        "composite_threshold",  # = 1 if composite_score >= 0.45
        "weather_severity_index",

        # ── POST-DISRUPTION OUTCOMES ──
        "order_demand_drop_pct",
        "supply_constraint",
        "delivery_delay_min",
        "actual_income",
        "daily_income",
        "income_loss",
        "weekly_income",
        "monthly_income",
        "sudden_income_spike",  # derived from income comparison

        # ── INCOME LEAKAGE COLS ──
        "expected_income",
        "earnings_per_order",
        "base_pay",
        "rolling_avg_income_7d",
    ]

    # ── Keep ONLY predictive context features ────────────────
    # These are knowable BEFORE or INDEPENDENT OF same-day disruption:
    # - Worker profile (platform, city, zone, experience, shift)
    # - Traffic index (congestion ≠ disruption trigger directly)
    # - Temporal: day_of_week, month, week, peak_hour, weekend
    # - Behavioral history: rolling_orders_3d, days_since_last_active
    # - Worker behavioral flags: location_jump, device_switch, cancelled_ratio

    features = [c for c in df.columns if c not in drop_cols]

    X = df[features].select_dtypes(include=["number"]).fillna(0)
    y = df[target].astype(int)

    print(f"\n  Disruption feature columns kept ({len(features)}):")
    print(f"  {features}")

    return X, y


# ---------------------------
# Fraud Model
# ---------------------------
def build_fraud_features(df):
    """
    Enhanced fraud features:
    - Worker-level behavioral aggregations
    - Temporal rolling claim features
    - Removes leakage columns
    """
    target = "fraud_flag"
    df = df.copy()

    # ── STEP 3: Worker-level aggregations ─────────────────
    # These capture behavioral patterns across all claims
    # A fraudster files many small claims rapidly
    if "worker_id" in df.columns and "claim_timestamp" not in df.columns:
        # claims without timestamps → use available numeric cols
        worker_agg = df.groupby("worker_id").agg(
            claim_count        = ("fraud_flag",              "count"),
            avg_income_loss    = ("income_loss",             "mean"),
            std_income_loss    = ("income_loss",             "std"),
            avg_response_time  = ("claim_response_time_sec", "mean"),
            avg_gps_delta      = ("gps_tower_delta",         "mean"),
            avg_accel_var      = ("accelerometer_variance",  "mean"),
            avg_app_int        = ("app_interaction_count",   "mean"),
            fraud_rate_worker  = ("fraud_flag",              "mean"),
        ).reset_index()
        worker_agg["std_income_loss"] = worker_agg["std_income_loss"].fillna(0)
        df = df.merge(worker_agg, on="worker_id", how="left", suffixes=("","_agg"))

    # ── STEP 4: Temporal features (if timestamp available) ─
    if "claim_timestamp" in df.columns:
        df["claim_timestamp"] = pd.to_datetime(df["claim_timestamp"],
                                               errors="coerce")
        df = df.sort_values(["worker_id","claim_timestamp"])

        # Time since last claim (in hours)
        df["prev_claim_time"] = df.groupby("worker_id")["claim_timestamp"].shift(1)
        df["hours_since_last_claim"] = (
            (df["claim_timestamp"] - df["prev_claim_time"])
            .dt.total_seconds() / 3600
        ).fillna(999)   # 999 = first claim (no prior)

        # Rolling claim count: last 3 and 7 claims per worker
        df["claims_last_3"] = (
            df.groupby("worker_id").cumcount()
            .clip(upper=3)
        )
        df["claims_last_7"] = (
            df.groupby("worker_id").cumcount()
            .clip(upper=7)
        )

        # Claim frequency: claims per active day
        if "days_active" in df.columns:
            df["claim_frequency"] = (
                df["claim_count"] /
                df["days_active"].replace(0, 1)
            )
        df.drop(columns=["prev_claim_time","claim_timestamp"],
                errors="ignore", inplace=True)

    # ── Abnormal behavior composite flag ──────────────────
    # Triggers if response is very fast AND GPS delta is high
    df["abnormal_behavior_flag"] = (
        (df.get("claim_response_time_sec", pd.Series(999, index=df.index)) < 45) &
        (df.get("gps_tower_delta", pd.Series(0, index=df.index)) > 500)
    ).astype(int)

    # ── Drop leakage columns ───────────────────────────────
    drop_cols = [
        "claim_id", "worker_id", "policy_id",
        "fraud_flag",
        "payout_amount",         # outcome leakage
        "payout_status_encoded", # outcome leakage
        "fraud_score",           # defines fraud_flag directly
    ]

    features = [c for c in df.columns if c not in drop_cols]

    X = df[features].select_dtypes(include=["number"]).fillna(0)
    y = df[target].astype(int)

    return X, y


# ---------------------------
# Disruption Realtime Model
# Uses same-day trigger signals — intentional, for real-time detection
# ---------------------------
def build_disruption_realtime_features(df):
    """
    Real-time disruption detection.
    Uses actual environmental + event trigger values.
    This is NOT leakage — it IS the intended design.
    A real-time model receives sensor readings and decides
    if disruption is occurring RIGHT NOW.
    """
    target = "disruption_flag"

    # Keep only trigger signals + worker context
    # Drop post-disruption OUTCOMES only
    drop_cols = [
        "disruption_flag",
        "log_id", "date", "worker_id",
        # Post-disruption outcomes
        "order_demand_drop_pct",
        "supply_constraint",
        "delivery_delay_min",
        "actual_income",
        "daily_income",
        "income_loss",
        "weekly_income",
        "monthly_income",
        "sudden_income_spike",
        "expected_income",
        "earnings_per_order",
        "base_pay",
        "rolling_avg_income_7d",
    ]

    features = [c for c in df.columns if c not in drop_cols]

    X = df[features].select_dtypes(include=["number"]).fillna(0)
    y = df[target].astype(int)

    return X, y
# ---------------------------
# MAIN
# ---------------------------
if __name__ == "__main__":
    income_df, disruption_df, fraud_df = load_feature_data()

    X_inc, y_inc = build_income_features(income_df)
    X_dis, y_dis = build_disruption_features(disruption_df)
    X_fra, y_fra = build_fraud_features(fraud_df)

    print("\n✅ Feature sets ready:")
    print(f"Income      X:{X_inc.shape}  y:{y_inc.shape}")
    print(f"Disruption  X:{X_dis.shape}  y:{y_dis.shape}")
    print(f"Fraud       X:{X_fra.shape}  y:{y_fra.shape}")