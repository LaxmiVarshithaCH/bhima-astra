"""
BHIMA ASTRA — Adaptive Decision Engine
Replaces all static thresholds with percentile-based decisioning.

How it works:
1. Combine fraud_prob (tabular XGBoost) + cluster_score (graph)
   into a single final_score
2. Rank final_score against a calibration distribution
   (built from training data at startup)
3. Use percentile rank → decision, not raw score → decision

Why this is better:
- Adapts to score distribution automatically
- Prevents score inflation/deflation from breaking decisions
- Impossible to game one signal without raising the other
"""

import numpy as np
import pandas as pd
import joblib
import os
import logging       # ✅ ADD THIS
from scipy import stats


# ══════════════════════════════════════════════════════════
# CALIBRATION DISTRIBUTION
# Built once at startup from training fraud scores.
# Used to compute percentile of any new score.
# ══════════════════════════════════════════════════════════
logger = logging.getLogger("bhima.decision_engine")
CALIBRATION = {
    "scores": None,   # np.array of historical final_scores
    "loaded": False,
}

CALIBRATION_PATH = "models/fraud_score_calibration.pkl"


def build_calibration_distribution(
    fraud_df: pd.DataFrame,
    fraud_model,
    fraud_features: list,
    graph_scores_df: pd.DataFrame,
) -> np.ndarray:
    """
    Build calibration distribution from training data.
    Called once during training — saves distribution to disk.

    Steps:
    1. Score all training claims with tabular model
    2. Join with graph cluster scores
    3. Compute final_score for every record
    4. Save distribution as array
    """
    print("\n[Calibration] Building score distribution...")

    # Tabular probabilities for all training claims
    X = fraud_df[fraud_features].select_dtypes(
        include=[np.number]).fillna(0)
    tabular_probs = fraud_model.predict_proba(X)[:, 1]

    # Join graph scores by worker_id
    if "worker_id" in fraud_df.columns and not graph_scores_df.empty:
        merged = fraud_df[["worker_id"]].copy()
        merged["tabular_prob"] = tabular_probs
        merged = merged.merge(
            graph_scores_df[["worker_id","fraud_cluster_score","cluster_size"]],
            on="worker_id", how="left"
        )
        merged["fraud_cluster_score"] = merged["fraud_cluster_score"].fillna(0)
        merged["cluster_size"]        = merged["cluster_size"].fillna(1)
    else:
        merged = pd.DataFrame({
            "tabular_prob":        tabular_probs,
            "fraud_cluster_score": np.zeros(len(tabular_probs)),
            "cluster_size":        np.ones(len(tabular_probs)),
        })

    # Compute final scores for calibration
    # Compute final scores for calibration (Vectorized)
    final_scores = compute_final_score(
        tabular_probs  = merged["tabular_prob"].values,
        cluster_scores = merged["fraud_cluster_score"].values,
        cluster_sizes  = merged["cluster_size"].values,
    )

    calibration_array = np.sort(final_scores)
    joblib.dump(calibration_array, CALIBRATION_PATH)
    CALIBRATION["scores"] = calibration_array
    CALIBRATION["loaded"] = True

    print(f"  Calibration built: {len(calibration_array)} samples")
    print(f"  Score range : {calibration_array.min():.4f} – "
          f"{calibration_array.max():.4f}")
    print(f"  P50={np.percentile(calibration_array,50):.4f}  "
          f"P90={np.percentile(calibration_array,90):.4f}  "
          f"P95={np.percentile(calibration_array,95):.4f}")

    return calibration_array


def load_calibration():
    """Load saved calibration distribution at inference startup."""
    global CALIBRATION
    if CALIBRATION["loaded"]:
        return
    if os.path.exists(CALIBRATION_PATH):
        CALIBRATION["scores"] = joblib.load(CALIBRATION_PATH)
        CALIBRATION["loaded"] = True
    else:
        # Fallback: uniform distribution so system still works
        CALIBRATION["scores"] = np.linspace(0, 1, 1000)
        CALIBRATION["loaded"] = True
        print("⚠️  Calibration not found — using uniform fallback. "
              "Run build_calibration_distribution() first.")


# ══════════════════════════════════════════════════════════
# SCORE COMBINATION
# ══════════════════════════════════════════════════════════

def normalize_cluster_score(raw_score: float,
                             min_val: float = 0.0,
                             max_val: float = 1.0) -> float:
    """
    Normalize cluster score to [0,1].
    cluster_score already outputs 0–1 from our formula,
    but this ensures compatibility if range changes.
    """
    if max_val == min_val:
        return 0.0
    normalized = (raw_score - min_val) / (max_val - min_val)
    return float(np.clip(normalized, 0.0, 1.0))


def compute_final_score(
    tabular_probs:  np.ndarray,
    cluster_scores: np.ndarray,
    cluster_sizes:  np.ndarray,
    w_tabular:      float = 0.70,
    w_cluster:      float = 0.30,
    cluster_boost_threshold: int   = 4,
    cluster_boost_amount:    float = 0.06,
) -> np.ndarray:
    tabular_probs  = np.clip(np.array(tabular_probs,  dtype=float), 0.0, 1.0)
    cluster_scores = np.clip(np.array(cluster_scores, dtype=float), 0.0, 1.0)
    cluster_sizes  = np.array(cluster_sizes, dtype=int)

    # Normalize cluster score across batch
    cs_min = cluster_scores.min()
    cs_max = cluster_scores.max()
    # Use direct cluster_score (already 0–1 from graph logic)
    cluster_scores_norm = cluster_scores

    # ✅ Dynamic weights per sample
    base_scores = np.zeros(len(tabular_probs))
    for i in range(len(tabular_probs)):
        wc = min(0.20 + 0.08 * cluster_sizes[i], 0.55)
        wt = 1 - wc
        # amplify cluster signal for meaningful clusters
        cluster_effect = cluster_scores_norm[i]

        if cluster_sizes[i] >= 3:
            cluster_effect = min(cluster_effect * 1.5, 1.0)

        base_scores[i] = wt * tabular_probs[i] + wc * cluster_effect

    cluster_boost = (cluster_sizes >= cluster_boost_threshold).astype(float)
    final_scores  = np.clip(
        base_scores + cluster_boost * cluster_boost_amount, 0.0, 1.0)

    return final_scores.astype(float)


# ══════════════════════════════════════════════════════════
# PERCENTILE COMPUTATION
# ══════════════════════════════════════════════════════════

def compute_percentile(final_score: float) -> float:
    """
    Compute percentile rank of a single score against
    the calibration distribution.

    Example:
        If final_score = 0.72 and 88% of calibration scores
        are below 0.72, then percentile = 0.88

    This means: "this score is higher than 88% of all
    scores we've seen in training."

    Why this matters:
        Score 0.55 with P99 → extremely rare → BLOCK
        Score 0.80 with P60 → common → maybe just REVIEW
    """
    load_calibration()
    arr = CALIBRATION["scores"]
    if arr is None or len(arr) == 0:
        return float(final_score)  # fallback: use raw score as percentile
    # stats.percentileofscore returns 0–100, we normalize to 0–1
    pct = stats.percentileofscore(arr, final_score, kind="weak") / 100.0
    return round(float(pct), 4)


# ══════════════════════════════════════════════════════════
# MAIN DECISION FUNCTION
# ══════════════════════════════════════════════════════════

def make_fraud_decision(
    tabular_prob:        float,
    cluster_score:       float,
    cluster_size:        int,
    behavior_score:      float = 0.0,   # NEW — Stage 2 input
    rule_score:          float = 0.0,   # NEW — Stage 1 input
    worker_id:           int   = 0,
    features:            dict  = None,
    block_percentile:    float = 0.90,
    review_percentile:   float = 0.70,
) -> dict:
    """
    Stage 4 — Adaptive Decision Engine (upgraded).
    Combines: tabular + graph + behavior + rules → percentile decision.
    Produces: decision + payout lifecycle action.
    """

    # ✅ ADD THIS LINE: Prevent massive clusters from breaking the score logic
    cluster_size = min(cluster_size, 20)

   # ── Step 1 & 2: Score Combination ─────────────────────
    final_score = compute_final_score(
        tabular_probs  = np.array([tabular_prob]),
        cluster_scores = np.array([cluster_score]),
        cluster_sizes  = np.array([cluster_size]),
    )[0]

    # THEN add behavior + rule influence
    final_score += 0.15 * behavior_score
    final_score += 0.10 * rule_score

    if cluster_size >= 3 and behavior_score > 0.5:
        final_score += 0.10

    final_score = float(np.clip(final_score, 0.0, 1.0))

    # ── Step 3: Percentile rank ────────────────────────────
    percentile = compute_percentile(final_score)

    # ── Step 4: Adaptive decision ──────────────────────────
    if percentile >= block_percentile:
        decision   = "BLOCK"
        fraud_flag = 1
    elif percentile >= review_percentile:
        decision   = "REVIEW"
        fraud_flag = 1
    else:
        decision   = "APPROVE"
        fraud_flag = 0

    # ── Step 5: Payout lifecycle ───────────────────────────
    if decision == "APPROVE":
        payout_status  = "FULL_RELEASE"
        hold_duration  = None
    elif decision == "REVIEW":
        payout_status  = "PARTIAL_RELEASE"
        hold_duration  = "48h"
    else:   # BLOCK
        payout_status  = "ON_HOLD"
        hold_duration  = None

    # ── Step 6: Reason extraction ──────────────────────────
    if decision == "APPROVE":
        reasons = ["normal"]
        primary = "normal"
    else:
        reasons = []
        if features:
            if features.get("gps_tower_delta", 0) > 600:
                reasons.append("gps_mismatch")
            if features.get("accelerometer_variance", 99) < 1.0:
                reasons.append("device_anomaly")
            if features.get("claim_response_time_sec", 999) < 45:
                reasons.append("abnormal_behavior")
        if cluster_size >= 3:
            reasons.append("ring_cluster")
        if behavior_score > 0.70:
            reasons.append("behavioral_anomaly")
        if rule_score >= 0.50:
            reasons.append("rule_triggered")
        if tabular_prob > 0.70:
            reasons.append("high_tabular_prob")
        if not reasons:
            reasons = ["multi_factor"]
        primary = reasons[0]

    logger.info(
        f"[Stage4-Decision] worker={worker_id}  "
        f"tabular={tabular_prob:.3f}  cluster={cluster_score:.3f}  "
        f"behavior={behavior_score:.3f}  rules={rule_score:.3f}  "
        f"final={final_score:.4f}  pct={percentile:.3f}  "
        f"→ {decision}  payout={payout_status}"
    )

    return {
        # Scores
        "worker_id":          worker_id,
        "tabular_fraud_prob": round(tabular_prob,   4),
        "cluster_score":      round(cluster_score,  4),
        "behavior_score":     round(behavior_score, 4),
        "rule_score":         round(rule_score,     4),
        "final_score":        round(final_score,    4),
        "percentile":         round(percentile,     4),
        "cluster_size":       cluster_size,
        # Decision
        "decision":           decision,
        "fraud_flag":         fraud_flag,
        "primary_reason":     primary,
        "all_reasons":        reasons,
        # Claim lifecycle
        "payout_status":      payout_status,
        "hold_duration":      hold_duration,
    }


# ══════════════════════════════════════════════════════════
# QUICK TEST
# ══════════════════════════════════════════════════════════

if __name__ == "__main__":
    print("Testing decision engine with synthetic scores...\n")

    # Simulate calibration
    np.random.seed(42)
    CALIBRATION["scores"] = np.sort(
        np.random.beta(2, 8, 2000))   # most scores low — realistic
    CALIBRATION["loaded"] = True

    test_cases = [
        {"tabular": 0.85, "cluster": 0.70, "size": 10, "label": "Clear fraud"},
        {"tabular": 0.45, "cluster": 0.55, "size": 9,  "label": "Ring member"},
        {"tabular": 0.30, "cluster": 0.20, "size": 2,  "label": "Borderline"},
        {"tabular": 0.10, "cluster": 0.05, "size": 1,  "label": "Clean worker"},
    ]

    for tc in test_cases:
        result = make_fraud_decision(
            tabular_prob  = tc["tabular"],
            cluster_score = tc["cluster"],
            cluster_size  = tc["size"],
            worker_id     = 999,
        )
        print(f"  [{tc['label']}]")
        print(f"    final={result['final_score']:.4f}  "
              f"pct={result['percentile']:.2f}  "
              f"→ {result['decision']}")