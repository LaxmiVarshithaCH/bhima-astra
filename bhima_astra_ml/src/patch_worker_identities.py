"""
BHIMA ASTRA — Identity Overlap Patcher
Introduces controlled shared identities into workers.csv
for realistic fraud graph construction.

Run ONCE after workers.csv is generated, BEFORE preprocess.py.
"""

import pandas as pd
import numpy as np
import random
import os

random.seed(42)
np.random.seed(42)


def patch_worker_identities(
    workers_path: str = "data/workers.csv",
    output_path:  str = "data/workers.csv",   # overwrite in place
):
    df = pd.read_csv(workers_path)
    total = len(df)
    print(f"Workers loaded: {total}")
    print(f"\nBEFORE patch:")
    print(f"  device_id unique : {df['device_id'].nunique()}")
    print(f"  upi_id unique    : {df['upi_id'].nunique()}")
    print(f"  bank_ifsc unique : {df['bank_ifsc'].nunique()}")

    worker_ids = df["worker_id"].tolist()

    # ══════════════════════════════════════════════════════
    # 1. DEVICE ID SHARING
    # 5–8% of workers share a device → groups of 2–4
    # ══════════════════════════════════════════════════════
    device_share_pct   = 0.07          # 7% of workers affected
    device_group_size  = (2, 4)        # each group has 2–4 workers
    n_device_workers   = int(total * device_share_pct)

    # Pick workers to be in device-sharing groups
    device_pool = random.sample(worker_ids, n_device_workers)

    # Split into small groups
    random.shuffle(device_pool)
    device_groups = []
    i = 0
    while i < len(device_pool):
        grp_size = random.randint(*device_group_size)
        grp      = device_pool[i: i + grp_size]
        if len(grp) >= 2:          # only groups of 2+
            device_groups.append(grp)
        i += grp_size

    # Assign same device_id to each group
    # Use one member's existing device_id as the shared value
    for grp in device_groups:
        shared_device = df.loc[
            df["worker_id"] == grp[0], "device_id"
        ].values[0]
        for wid in grp[1:]:        # keep grp[0] unchanged
            df.loc[df["worker_id"] == wid, "device_id"] = shared_device

    print(f"\n  Device groups created : {len(device_groups)}")

    # ══════════════════════════════════════════════════════
    # 2. UPI ID SHARING
    # 3–5% of workers share a upi_id → groups of 2–3
    # ══════════════════════════════════════════════════════
    upi_share_pct  = 0.04
    upi_group_size = (2, 3)
    n_upi_workers  = int(total * upi_share_pct)

    # Exclude workers already in device groups for cleaner signals
    device_affected = [wid for grp in device_groups for wid in grp]
    upi_candidates  = [w for w in worker_ids if w not in device_affected]
    upi_pool        = random.sample(
        upi_candidates, min(n_upi_workers, len(upi_candidates))
    )

    random.shuffle(upi_pool)
    upi_groups = []
    i = 0
    while i < len(upi_pool):
        grp_size = random.randint(*upi_group_size)
        grp      = upi_pool[i: i + grp_size]
        if len(grp) >= 2:
            upi_groups.append(grp)
        i += grp_size

    for grp in upi_groups:
        shared_upi = df.loc[
            df["worker_id"] == grp[0], "upi_id"
        ].values[0]
        for wid in grp[1:]:
            df.loc[df["worker_id"] == wid, "upi_id"] = shared_upi

    print(f"  UPI groups created    : {len(upi_groups)}")

    # ══════════════════════════════════════════════════════
    # 3. BANK IFSC SHARING
    # 10–18% of workers share same IFSC → groups of 5–15
    # IFSC is a weak signal — large groups are realistic
    # (many workers use same branch legitimately)
    # ══════════════════════════════════════════════════════
    ifsc_share_pct  = 0.15
    ifsc_group_size = (5, 15)
    n_ifsc_workers  = int(total * ifsc_share_pct)

    ifsc_pool = random.sample(worker_ids, n_ifsc_workers)
    random.shuffle(ifsc_pool)
    ifsc_groups = []
    i = 0
    while i < len(ifsc_pool):
        grp_size = random.randint(*ifsc_group_size)
        grp      = ifsc_pool[i: i + grp_size]
        if len(grp) >= 2:
            ifsc_groups.append(grp)
        i += grp_size

    for grp in ifsc_groups:
        shared_ifsc = df.loc[
            df["worker_id"] == grp[0], "bank_ifsc"
        ].values[0]
        for wid in grp[1:]:
            df.loc[df["worker_id"] == wid, "bank_ifsc"] = shared_ifsc

    print(f"  IFSC groups created   : {len(ifsc_groups)}")

    # ══════════════════════════════════════════════════════
    # VERIFY RESULTS
    # ══════════════════════════════════════════════════════
    print(f"\nAFTER patch:")
    print(f"  device_id unique : {df['device_id'].nunique()}"
          f"  (was {total})")
    print(f"  upi_id unique    : {df['upi_id'].nunique()}"
          f"  (was {total})")
    print(f"  bank_ifsc unique : {df['bank_ifsc'].nunique()}"
          f"  (was {total})")

    # Uniqueness check — at least 70% still unique
    assert df["device_id"].nunique() >= total * 0.70, \
        "Too many shared device_ids — reduce device_share_pct"
    assert df["upi_id"].nunique()    >= total * 0.80, \
        "Too many shared upi_ids — reduce upi_share_pct"

    # Save
    df.to_csv(output_path, index=False)
    print(f"\n✅ Patched workers.csv saved → {output_path}")

    return df


if __name__ == "__main__":
    patch_worker_identities()