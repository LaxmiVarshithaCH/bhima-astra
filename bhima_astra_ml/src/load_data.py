import pandas as pd
import os

DATA_PATH = "data/"

def load_datasets():
    workers      = pd.read_csv(os.path.join(DATA_PATH, "workers.csv"))
    daily_ops    = pd.read_csv(os.path.join(DATA_PATH, "daily_operations.csv"))
    policy_claims= pd.read_csv(os.path.join(DATA_PATH, "policy_claims.csv"))
    return workers, daily_ops, policy_claims

def verify_datasets(workers, daily_ops, policy_claims):
    print("=" * 55)
    print("WORKERS")
    print(f"  Shape     : {workers.shape}")
    print(f"  Columns   : {list(workers.columns)}")
    print(f"  Nulls     :\n{workers.isnull().sum()[workers.isnull().sum()>0]}")
    print(f"  Duplicates: {workers.duplicated().sum()}")

    print("\nDAILY OPERATIONS")
    print(f"  Shape     : {daily_ops.shape}")
    print(f"  Columns   : {list(daily_ops.columns)}")
    print(f"  Nulls     :\n{daily_ops.isnull().sum()[daily_ops.isnull().sum()>0]}")
    print(f"  Disruption rate: {daily_ops['disruption_flag'].mean()*100:.1f}%")

    print("\nPOLICY & CLAIMS")
    print(f"  Shape     : {policy_claims.shape}")
    print(f"  Columns   : {list(policy_claims.columns)}")
    print(f"  Nulls     :\n{policy_claims.isnull().sum()[policy_claims.isnull().sum()>0]}")
    print(f"  Payout dist:\n{policy_claims['payout_status'].value_counts()}")

    print("\nREFERENTIAL INTEGRITY")
    ri1 = set(daily_ops["worker_id"]).issubset(set(workers["worker_id"]))
    ri2 = set(policy_claims["worker_id"]).issubset(set(workers["worker_id"]))
    print(f"  daily_ops  → workers : {'✅ OK' if ri1 else '❌ FAIL'}")
    print(f"  policy     → workers : {'✅ OK' if ri2 else '❌ FAIL'}")

if __name__ == "__main__":
    w, d, p = load_datasets()
    verify_datasets(w, d, p)