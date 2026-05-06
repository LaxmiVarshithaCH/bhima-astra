"""
BHIMA ASTRA — Stage 1: Rule Engine
Deterministic pre-filter. Runs before any ML model.
Fast, zero-cost, catches obvious fraud instantly.
"""

import logging

logger = logging.getLogger("bhima.rules")


# ── Thresholds ────────────────────────────────────────────
GPS_DELTA_THRESHOLD      = 500    # metres
ACCEL_VARIANCE_THRESHOLD = 0.5    # below = stationary
RESPONSE_TIME_THRESHOLD  = 60     # seconds — too fast = bot
MIN_FLAGS_FOR_REVIEW     = 2      # flags needed to escalate


def run_rule_engine(features: dict) -> dict:
    """
    Stage 1 — Deterministic Rule Filter.

    Returns:
        rule_score    : float 0–1 (fraction of rules triggered)
        rule_flags    : list of triggered rule names
        rule_decision : PASS (clean) or REVIEW (escalate)
    """
    flags = []

    # ── Rule 1: GPS / Cell Tower Mismatch ─────────────────
    gps_delta = float(features.get("gps_tower_delta", 0))
    if gps_delta > GPS_DELTA_THRESHOLD:
        flags.append("gps_mismatch")
        logger.debug(f"  Rule: gps_mismatch  delta={gps_delta:.1f}m")

    # ── Rule 2: No Motion (stationary spoofer) ────────────
    accel = float(features.get("accelerometer_variance", 99))
    if accel < ACCEL_VARIANCE_THRESHOLD:
        flags.append("no_motion")
        logger.debug(f"  Rule: no_motion  accel={accel:.4f}")

    # ── Rule 3: Timing Anomaly (bot-speed filing) ─────────
    resp_time = float(features.get("claim_response_time_sec", 999))
    if resp_time < RESPONSE_TIME_THRESHOLD:
        flags.append("timing_anomaly")
        logger.debug(f"  Rule: timing_anomaly  resp={resp_time:.0f}s")

    # ── Rule 4: Device Blacklist ───────────────────────────
    device_flagged = int(features.get("device_flagged", 0))
    if device_flagged == 1:
        flags.append("device_blacklist")
        logger.debug("  Rule: device_blacklist")

    # ── Score + Decision ───────────────────────────────────
    total_rules  = 4
    rule_score   = round(len(flags) / total_rules, 4)
    rule_decision = "REVIEW" if len(flags) >= MIN_FLAGS_FOR_REVIEW else "PASS"

    result = {
        "rule_score":    rule_score,
        "rule_flags":    flags,
        "rule_decision": rule_decision,
    }

    logger.info(
        f"[Stage1-Rules] flags={flags}  "
        f"score={rule_score}  decision={rule_decision}"
    )
    return result


if __name__ == "__main__":
    # Quick test
    test_cases = [
        {
            "label": "Clear GPS spoofer",
            "gps_tower_delta":         850,
            "accelerometer_variance":  0.2,
            "claim_response_time_sec": 30,
            "device_flagged":          0,
        },
        {
            "label": "Clean worker",
            "gps_tower_delta":         80,
            "accelerometer_variance":  12.5,
            "claim_response_time_sec": 180,
            "device_flagged":          0,
        },
        {
            "label": "Borderline",
            "gps_tower_delta":         520,
            "accelerometer_variance":  0.8,
            "claim_response_time_sec": 45,
            "device_flagged":          0,
        },
    ]
    for tc in test_cases:
        label = tc.pop("label")
        result = run_rule_engine(tc)
        print(f"[{label}] → {result}")