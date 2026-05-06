import pandas as pd
import os

def load_processed_data():
    workers = pd.read_csv("data/processed/workers_clean.csv")
    daily   = pd.read_csv("data/processed/daily_clean.csv")
    claims  = pd.read_csv("data/processed/claims_clean.csv")

    return workers, daily, claims


def merge_datasets(workers, daily):
    print("Merging workers + daily operations...")

    merged = daily.merge(
        workers,
        on="worker_id",
        how="left"
    )

    print(f"Merged shape: {merged.shape}")

    # Check for missing merges
    missing = merged.isnull().sum()
    missing = missing[missing > 0]

    print("Missing values after merge:")
    print(missing if not missing.empty else "None")

    return merged


def create_feature_datasets(merged, claims):
    print("Creating model-specific datasets...")

    drop_cols = ["worker_name", "upi_id", "bank_ifsc", "device_id"]

    income_df     = merged.drop(
        columns=[c for c in drop_cols if c in merged.columns]).copy()
    disruption_df = income_df.copy()

    # ── Income/Disruption: normalized weather stress ───────
    for col in ["rainfall", "AQI", "traffic_index"]:
        if col not in income_df.columns:
            income_df[col] = 0

    income_df["weather_stress"] = (
        0.4 * (income_df["rainfall"]     / 300.0) +
        0.3 * (income_df["AQI"]          / 500.0) +
        0.3 * (income_df["traffic_index"]/ 100.0)
    )
    disruption_df["weather_stress"] = income_df["weather_stress"]

    # ── Income: additional behavioral features ─────────────
    if "orders_per_day" in income_df.columns:
        income_df["orders_std"] = (
            income_df.groupby("worker_id")["orders_per_day"]
            .transform("std").fillna(0)
        )

    if "disruption_flag" in income_df.columns:
        total_days = income_df.groupby("worker_id")["disruption_flag"].transform("count")
        income_df["active_days_ratio"] = (
            income_df.groupby("worker_id")["disruption_flag"]
            .transform("sum") / total_days.replace(0, 1)
        )

    # ── Fraud: merge worker profile into claims ────────────
    # Load workers_clean to attach profile signals to each claim
    fraud_df = claims.copy().fillna(0)
    workers_clean_path = "data/processed/workers_clean.csv"
    if os.path.exists(workers_clean_path):
        workers_profile = pd.read_csv(workers_clean_path)
        # Keep only useful numeric worker-level signals
        profile_cols = [
            "worker_id", "experience_level",
            "shift_hours", "fraud_risk_score",
            "kyc_verified", "bank_verified",
        ]
        profile_cols = [c for c in profile_cols
                        if c in workers_profile.columns]
        workers_subset = workers_profile[profile_cols]
        fraud_df = fraud_df.merge(
            workers_subset, on="worker_id", how="left"
        )
        print(f"  Fraud: merged worker profile → {fraud_df.shape}")

    print(f"  Income dataset     : {income_df.shape}")
    print(f"  Disruption dataset : {disruption_df.shape}")
    print(f"  Fraud dataset      : {fraud_df.shape}")

    return income_df, disruption_df, fraud_df


def save_feature_datasets(income_df, disruption_df, fraud_df):
    os.makedirs("data/features", exist_ok=True)

    income_df.to_csv("data/features/income.csv", index=False)
    disruption_df.to_csv("data/features/disruption.csv", index=False)
    fraud_df.to_csv("data/features/fraud.csv", index=False)

    print("\n✅ Feature datasets saved in data/features/")


def run_feature_engineering():
    workers, daily, claims = load_processed_data()

    merged = merge_datasets(workers, daily)

    income_df, disruption_df, fraud_df = create_feature_datasets(merged, claims)

    save_feature_datasets(income_df, disruption_df, fraud_df)


if __name__ == "__main__":
    run_feature_engineering()