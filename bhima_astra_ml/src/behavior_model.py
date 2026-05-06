"""
BHIMA ASTRA — Stage 2: Behavioral Anomaly Model
Simulates LSTM-style sequential scoring using rolling features.
Scores behavioral consistency of a claim event.
"""

import numpy as np
import logging

logger = logging.getLogger("bhima.behavior")


# ── Feature weights (sum to 1.0) ──────────────────────────
WEIGHTS = {
    "gps_component":        0.30,   # GPS/tower mismatch signal
    "motion_component":     0.25,   # Accelerometer — are they moving?
    "interaction_component":0.25,   # App events — human-like behavior?
    "location_jump":        0.20,   # Sudden location change
}


def _normalize(value: float,
               min_val: float,
               max_val: float,
               invert: bool = False) -> float:
    """
    Normalize a raw value to [0, 1].
    invert=True → higher raw value = lower score (e.g. more motion = less suspicious)
    """
    if max_val == min_val:
        return 0.0
    norm = (value - min_val) / (max_val - min_val)
    norm = float(np.clip(norm, 0.0, 1.0))
    return (1.0 - norm) if invert else norm


def compute_behavior_score(features: dict) -> float:
    """
    Stage 2 — Behavioral Anomaly Scoring.

    Simulates what an LSTM would capture from time-series:
    rhythm, motion consistency, interaction patterns.

    Returns:
        behavior_score: float [0, 1]
        < 0.30 → normal behavior
        0.30 – 0.70 → suspicious
        > 0.70 → high anomaly (likely fraud)
    """
    # ── Component 1: GPS/tower mismatch ───────────────────
    # High delta = suspicious (phone GPS ≠ cell tower location)
    gps_delta = float(features.get("gps_tower_delta", 0))
    gps_component = _normalize(gps_delta, min_val=0, max_val=5000)

    # ── Component 2: Motion signal ─────────────────────────
    # Low accelerometer variance = worker not moving = spoofer at home
    accel = float(features.get("accelerometer_variance", 20))
    # Invert: high variance (moving) = low suspicion
    motion_component = _normalize(accel, min_val=0, max_val=50, invert=True)

    # ── Component 3: App interaction count ────────────────
    # Very few interactions = bot-like / scripted filing
    app_int = float(features.get("app_interaction_count", 10))
    # Invert: more interactions = more human-like = less suspicious
    interaction_component = _normalize(
        app_int, min_val=0, max_val=60, invert=True)

    # ── Component 4: Location jump ─────────────────────────
    # Binary: sudden teleportation between delivery zones
    location_jump = float(features.get("location_jump_flag", 0))
    # Already 0/1 — treat as direct component

    # ── Weighted combination ───────────────────────────────
    raw_score = (
        WEIGHTS["gps_component"]         * gps_component +
        WEIGHTS["motion_component"]      * motion_component +
        WEIGHTS["interaction_component"] * interaction_component +
        WEIGHTS["location_jump"]         * location_jump
    )
    behavior_score = round(float(np.clip(raw_score, 0.0, 1.0)), 4)

    logger.info(
        f"[Stage2-Behavior] "
        f"gps={gps_component:.3f}  "
        f"motion={motion_component:.3f}  "
        f"interact={interaction_component:.3f}  "
        f"jump={location_jump:.1f}  "
        f"→ score={behavior_score}"
    )

    return behavior_score


if __name__ == "__main__":
    test_cases = [
        {
            "label": "GPS spoofer at home",
            "gps_tower_delta": 1200,
            "accelerometer_variance": 0.1,
            "app_interaction_count": 1,
            "location_jump_flag": 1,
        },
        {
            "label": "Normal delivery worker",
            "gps_tower_delta": 50,
            "accelerometer_variance": 18.5,
            "app_interaction_count": 25,
            "location_jump_flag": 0,
        },
        {
            "label": "Borderline suspicious",
            "gps_tower_delta": 550,
            "accelerometer_variance": 3.2,
            "app_interaction_count": 5,
            "location_jump_flag": 0,
        },
    ]
    for tc in test_cases:
        label = tc.pop("label")
        score = compute_behavior_score(tc)
        interp = ("NORMAL" if score < 0.30 else
                  "SUSPICIOUS" if score < 0.70 else "HIGH ANOMALY")
        print(f"[{label}] → score={score}  [{interp}]")