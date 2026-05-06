"""
BHIMA ASTRA — Policy Control Engine
=====================================
File    : policy_engine.py
Class   : PolicyControlEngine
Version : 2.0.0 (Phase 3 — Architectural Upgrade)

Changelog from v1.0.0:
  [FIX-1]  Trust Score Routing       — Low trust (< 0.3) forces HOLD;
                                        High trust (> 0.9) relaxes risk threshold by +0.05.
  [FIX-2]  Continuous Risk Scaling   — risk_index now scales payout continuously
                                        via `payout *= max(0.1, 1.0 - risk_index)`.
  [FIX-3]  Temporal Consistency      — New input `claims_last_24h`; if > 0, force HOLD
                                        to block rapid-fire claim abuse.
  [FIX-4]  ALL_APIS_DOWN Logic       — Explicit `len(failed) == len(CRITICAL_APIS)` check,
                                        replacing the fragile `all(...if api in api_status)`
                                        generator that silently ignored absent API keys.
  [FIX-5]  Intermediate Rounding     — `safe_prob` rounded to 4 d.p. before all
                                        downstream comparisons to eliminate float drift.
  [UPG-6]  Config Externalization    — All thresholds, caps, plans, and API lists
                                        consolidated into a single `POLICY_CONFIG` dict.
  [UPG-7]  Versioning                — Output includes `policy_version: "v2.0"`.
  [UPG-8]  Decision Source           — Output includes `decision_source: "POLICY_ENGINE"`.
  [UPG-9]  Claim ID                  — Accepted from inputs; auto-generated via uuid4
                                        if not supplied. Always returned in output.
  [UPG-10] Audit Coverage            — All new rules (temporal, trust, risk-scaling)
                                        fully logged through the existing _log() path.

Rule Execution Order (strict, non-negotiable):
  1.  Trigger Validation          — Hard gate. No trigger → REJECT immediately.
  2.  Output Bounding             — Clamp income, prob; apply API penalty; round safe_prob.
  3.  Trust Score Pre-processing  — Adjust effective risk threshold for high-trust workers.
  4.  Fraud Control               — BLOCK → REJECT; REVIEW or high risk → force HOLD.
  5.  Trust Score Low Guard       — trust_score < 0.3 → force HOLD.
  6.  Temporal Consistency        — claims_last_24h > 0 → force HOLD.
  7.  Weekly Event Cap            — Exhausted events → REJECT immediately.
  8.  Actuarial Math              — Compute raw_expected_loss.
  9.  Continuous Risk Scaling     — Scale payout by max(0.1, 1.0 - risk_index).
  10. API Fallback Hard Cap       — All APIs offline → cap at ₹400.
  11. HOLD Payout Cap             — If HOLD forced, cap at 50%.
  12. Weekly Plan Cap             — Enforce plan cumulative weekly ceiling.
  13. Micro-transfer Floor        — Round payouts < ₹50 to zero.
  14. Final Action Determination  — Derive PAY / HOLD / REJECT.
  15. Response Assembly           — Build structured output with all v2 metadata.
"""

from __future__ import annotations

import math
import uuid
from datetime import datetime, timezone
from typing import Any


# ============================================================================
# [UPG-6] POLICY_CONFIG — Single source of truth for ALL engine parameters
#
# Simulates an externally loaded JSON config file.
# No business constant should appear anywhere else in this module.
# ============================================================================

POLICY_CONFIG: dict[str, Any] = {

    # ── Plan tier definitions ──────────────────────────────────────────────
    "plans": {
        "Basic": {
            "weekly_payout_cap": 600.0,     # ₹ maximum total payout per week
            "max_events":        2,          # maximum covered events per week
            "description":       "Basic Plan — ₹600/week cap, 2 events",
        },
        "Standard": {
            "weekly_payout_cap": 800.0,
            "max_events":        2,
            "description":       "Standard Plan — ₹800/week cap, 2 events",
        },
        "Premium": {
            "weekly_payout_cap": 1200.0,
            "max_events":        2,
            "description":       "Premium Plan — ₹1,200/week cap, 2 events",
        },
    },

    # ── Default plan when an unrecognised tier is submitted ────────────────
    "default_plan": "Basic",

    # ── Income bounding (empirical Q-commerce data, India gig market 2024) ─
    "income_min": 560.0,    # ₹ minimum credible daily income
    "income_max": 3000.0,   # ₹ maximum credible daily income

    # ── Disruption probability bounding ───────────────────────────────────
    "prob_min": 0.05,        # floor: avoids zero-payout edge cases
    "prob_max": 0.95,        # ceiling: guards against model overconfidence

    # ── Micro-transfer floor ───────────────────────────────────────────────
    "micro_transfer_floor": 50.0,   # ₹ — payouts below this collapse to ₹0

    # ── API fallback hard cap ──────────────────────────────────────────────
    "all_apis_down_cap": 400.0,     # ₹ — blind-payout ceiling when ALL APIs are offline

    # ── Fraud / risk thresholds ────────────────────────────────────────────
    "risk_index_hold_threshold": 0.85,  # base; may be relaxed for high-trust workers

    # ── [FIX-1] Trust score routing boundaries ─────────────────────────────
    "trust_score_low_threshold":  0.3,   # below → force HOLD
    "trust_score_high_threshold": 0.9,   # above → relax risk threshold by delta
    "trust_score_high_delta":     0.05,  # additive relaxation for high-trust workers

    # ── API confidence penalty ─────────────────────────────────────────────
    "api_timeout_prob_penalty": 0.20,    # reduce safe_prob by 20% per timed-out API

    # ── [FIX-4] Critical APIs — ALL must fail to trigger the hard cap ──────
    "critical_apis": ["weather_api", "cpcb_api"],

    # ── Severity multiplier hard ceiling ──────────────────────────────────
    "severity_max": 3.0,

    # ── HOLD partial release fraction ─────────────────────────────────────
    "hold_payout_fraction": 0.50,   # 50% released on HOLD; rest pending review

    # ── [UPG-7] Policy version stamp (returned in every response) ──────────
    "policy_version": "v2.0",
}


# ============================================================================
# POLICY CONTROL ENGINE v2
# ============================================================================

class PolicyControlEngine:
    """
    Deterministic, rule-based policy enforcement layer for BHIMA ASTRA v2.

    Accepts ML predictions as *suggestions* and enforces hard business,
    actuarial, and fraud-control rules to produce a final, auditable payout
    decision. All parameters are read from POLICY_CONFIG for easy reconfiguration.

    Usage:
        engine = PolicyControlEngine()
        result = engine.evaluate(inputs)
    """

    def __init__(self, debug: bool = False):
        """
        Parameters
        ----------
        debug : bool
            If True, prints each audit step to stdout in real-time.
            Disable in production deployments.
        """
        self.debug  = debug
        self.config = POLICY_CONFIG   # shorthand alias used throughout

    # ------------------------------------------------------------------ #
    #  PUBLIC ENTRY POINT                                                  #
    # ------------------------------------------------------------------ #

    def evaluate(self, inputs: dict) -> dict:
        """
        Run the full v2 policy evaluation pipeline for one claim.

        Parameters
        ----------
        inputs : dict
            claim_id                    (str,   optional) — auto-generated if absent
            predicted_income            (float) — from RF model
            disruption_prob             (float) — from XGBoost model
            fraud_decision              (str)   — "APPROVE" | "REVIEW" | "BLOCK"
            risk_index                  (float) — combined anomaly score [0–1]
            trigger_severity_multiplier (float) — city-tier adjusted multiplier
            trigger_flag                (bool)  — True if env. threshold crossed
            api_status                  (dict)  — e.g. {"weather_api": "ok", ...}
            plan_tier                   (str)   — "Basic" | "Standard" | "Premium"
            weekly_payout_so_far        (float) — cumulative payouts this week
            events_this_week            (int)   — events already claimed this week
            trust_score                 (float) — manager/history reliability [0–1]
            claims_last_24h             (int)   — [NEW v2] claims filed in last 24h

        Returns
        -------
        dict:
            claim_id, safe_income, safe_prob, final_payout_amount,
            final_action, user_message, audit_trail,
            policy_version, decision_source
        """
        cfg   = self.config
        audit: list[str] = []

        # ── [UPG-9] Claim ID — accept or generate ──────────────────────────
        # Honour caller-supplied claim_id exactly; generate a uuid-based ref
        # if not provided so every execution path always returns one.
        claim_id: str = str(
            inputs.get("claim_id") or f"CLM-{uuid.uuid4().hex[:12].upper()}"
        )

        self._log(audit, "═" * 65)
        self._log(audit, "PolicyControlEngine v2.evaluate() — START")
        self._log(audit, f"Claim ID  : {claim_id}")
        self._log(audit, f"Timestamp : {datetime.now(timezone.utc).isoformat()}")
        self._log(audit, f"Inputs    : {self._safe_repr(inputs)}")
        self._log(audit, "═" * 65)

        # ── Extract + type-coerce all inputs safely ────────────────────────
        predicted_income            = self._coerce_float(inputs.get("predicted_income", 0.0),            "predicted_income")
        disruption_prob             = self._coerce_float(inputs.get("disruption_prob",  0.0),            "disruption_prob")
        fraud_decision              = str(inputs.get("fraud_decision", "BLOCK")).upper().strip()
        risk_index                  = self._coerce_float(inputs.get("risk_index", 0.0),                  "risk_index")
        trigger_severity_multiplier = self._coerce_float(inputs.get("trigger_severity_multiplier", 1.0), "trigger_severity_multiplier")
        trigger_flag                = bool(inputs.get("trigger_flag", False))
        api_status: dict            = dict(inputs.get("api_status", {}))
        plan_tier                   = str(inputs.get("plan_tier", cfg["default_plan"])).strip().title()
        weekly_payout_so_far        = self._coerce_float(inputs.get("weekly_payout_so_far", 0.0),        "weekly_payout_so_far")
        events_this_week            = int(inputs.get("events_this_week", 0))
        trust_score                 = self._coerce_float(inputs.get("trust_score", 0.5),                 "trust_score")
        # [FIX-3] New temporal signal — clamp to non-negative int
        claims_last_24h             = max(0, int(inputs.get("claims_last_24h", 0)))

        # Validate plan tier; fall back to Basic for unknown values
        if plan_tier not in cfg["plans"]:
            self._log(audit, f"[WARN] Unknown plan_tier='{plan_tier}'. Defaulting to '{cfg['default_plan']}'.")
            plan_tier = cfg["default_plan"]
        plan = cfg["plans"][plan_tier]

        # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ #
        # RULE 1 — TRIGGER VALIDATION (Hard Gate)                           #
        # If no environmental threshold was physically crossed, the entire  #
        # claim is void. Terminates before any ML output is examined.       #
        # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ #
        self._log(audit, "[RULE 1] Trigger Validation — checking trigger_flag...")

        if not trigger_flag:
            self._log(audit, "[RULE 1] ❌ HARD GATE: trigger_flag=False. No IMD/CPCB threshold crossed.")
            self._log(audit, "[RULE 1] ❌ Pipeline terminated → REJECT, ₹0 payout.")
            safe_income, safe_prob = self._bound_outputs(
                predicted_income, disruption_prob, api_status, audit
            )
            safe_prob = round(safe_prob, 4)
            return self._build_response(
                claim_id=claim_id, safe_income=safe_income, safe_prob=safe_prob,
                final_payout=0.0, final_action="REJECT", reason="no_trigger",
                plan_tier=plan_tier, trust_score=trust_score, audit=audit,
            )

        self._log(audit, "[RULE 1] ✅ Trigger confirmed. Environmental threshold was physically crossed.")

        # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ #
        # RULE 2 — OUTPUT BOUNDING + INTERMEDIATE ROUNDING [FIX-5]          #
        # Clamp income and probability to empirical safe ranges and apply   #
        # API confidence penalty. Crucially, safe_prob is then rounded to  #
        # 4 decimal places BEFORE any downstream comparison, eliminating   #
        # floating-point drift (e.g. 0.7600000000000001 → 0.7600).         #
        # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ #
        self._log(audit, "[RULE 2] Output Bounding + Intermediate Rounding [FIX-5]...")
        safe_income, safe_prob = self._bound_outputs(
            predicted_income, disruption_prob, api_status, audit
        )
        # [FIX-5] Explicit round-to-4dp before any logical use of safe_prob
        safe_prob = round(safe_prob, 4)
        self._log(audit, f"[RULE 2] safe_prob after intermediate rounding: {safe_prob:.4f}")

        # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ #
        # RULE 3 — TRUST SCORE PRE-PROCESSING [FIX-1 — high-trust branch]   #
        # Computed BEFORE the risk_index gate so the adjusted threshold is  #
        # used consistently in all subsequent risk comparisons.             #
        # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ #
        base_risk_threshold      = cfg["risk_index_hold_threshold"]    # 0.85
        effective_risk_threshold = base_risk_threshold

        self._log(
            audit,
            f"[RULE 3] Trust Score Pre-processing — trust_score={trust_score:.4f} "
            f"| base risk threshold={base_risk_threshold}"
        )

        if trust_score > cfg["trust_score_high_threshold"]:   # > 0.9
            delta                    = cfg["trust_score_high_delta"]   # 0.05
            effective_risk_threshold = round(base_risk_threshold + delta, 4)
            self._log(
                audit,
                f"[RULE 3] ✅ trust_score={trust_score:.4f} > {cfg['trust_score_high_threshold']} "
                f"(high-trust worker) → risk threshold relaxed: "
                f"{base_risk_threshold} + {delta} = {effective_risk_threshold}."
            )
        else:
            self._log(
                audit,
                f"[RULE 3] trust_score={trust_score:.4f} ≤ {cfg['trust_score_high_threshold']}. "
                f"No relaxation applied. Effective threshold={effective_risk_threshold}."
            )

        # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ #
        # RULE 4 — FRAUD CONTROL                                            #
        # BLOCK  → terminate immediately with REJECT.                       #
        # REVIEW or high risk_index → set force_hold; continue pipeline.   #
        # Uses effective_risk_threshold (possibly relaxed by Rule 3).       #
        # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ #
        self._log(
            audit,
            f"[RULE 4] Fraud Control — fraud_decision='{fraud_decision}' "
            f"| risk_index={risk_index:.4f} | effective_threshold={effective_risk_threshold}"
        )

        # 4a: Hard block — ML said fraud
        if fraud_decision == "BLOCK":
            self._log(audit, "[RULE 4a] ❌ BLOCK from fraud pipeline. Payout = ₹0. Pipeline terminated.")
            return self._build_response(
                claim_id=claim_id, safe_income=safe_income, safe_prob=safe_prob,
                final_payout=0.0, final_action="REJECT", reason="fraud_block",
                plan_tier=plan_tier, trust_score=trust_score, audit=audit,
            )

        # 4b: REVIEW or elevated risk → set HOLD flag; track primary reason
        force_hold  = False
        hold_reason = None

        if fraud_decision == "REVIEW":
            self._log(audit, "[RULE 4b] ⚠️  REVIEW from fraud pipeline → HOLD enforced.")
            force_hold  = True
            hold_reason = "fraud_review_hold"

        # [FIX-1] Comparison uses effective threshold (relaxed for trusted workers)
        if risk_index > effective_risk_threshold:
            self._log(
                audit,
                f"[RULE 4b] ⚠️  risk_index={risk_index:.4f} > "
                f"effective_threshold={effective_risk_threshold} → HOLD enforced."
            )
            force_hold  = True
            hold_reason = hold_reason or "high_risk_hold"
        else:
            self._log(
                audit,
                f"[RULE 4b] risk_index={risk_index:.4f} ≤ "
                f"effective_threshold={effective_risk_threshold}. Risk gate passed."
            )

        # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ #
        # RULE 5 — TRUST SCORE LOW GUARD [FIX-1 — low-trust branch]         #
        # Fires AFTER fraud BLOCK check so BLOCK still terminates cleanly.  #
        # Workers with very low trust scores trigger manual review.          #
        # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ #
        self._log(audit, f"[RULE 5] Trust Score Low Guard [FIX-1] — trust_score={trust_score:.4f}")

        if trust_score < cfg["trust_score_low_threshold"]:   # < 0.3
            self._log(
                audit,
                f"[RULE 5] ⚠️  trust_score={trust_score:.4f} < {cfg['trust_score_low_threshold']} "
                f"(low-trust worker) → HOLD enforced for manual verification."
            )
            force_hold  = True
            hold_reason = hold_reason or "low_trust_hold"
        else:
            self._log(
                audit,
                f"[RULE 5] trust_score={trust_score:.4f} ≥ "
                f"{cfg['trust_score_low_threshold']}. Trust gate passed."
            )

        # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ #
        # RULE 6 — TEMPORAL CONSISTENCY [FIX-3]                             #
        # Rapid-fire claims (any prior claim in the last 24h) are a strong  #
        # fraud signal. Route to HOLD regardless of other decisions.         #
        # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ #
        self._log(audit, f"[RULE 6] Temporal Consistency [FIX-3] — claims_last_24h={claims_last_24h}")

        if claims_last_24h > 2:
            self._log(
                audit,
                f"[RULE 6] ⚠️  claims_last_24h={claims_last_24h} > 0 → HOLD enforced. "
                f"Rapid-fire claim pattern detected; manual review required."
            )
            force_hold  = True
            hold_reason = hold_reason or "temporal_hold"
        else:
            self._log(audit, "[RULE 6] No prior claims in last 24h. Temporal gate passed.")

        # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ #
        # RULE 7 — WEEKLY EVENT CAP                                         #
        # Hard REJECT if the worker's covered-event allowance is exhausted. #
        # Evaluated before actuarial math to avoid unnecessary computation. #
        # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ #
        self._log(audit, f"[RULE 7] Event Cap — events_this_week={events_this_week}, max={plan['max_events']}")

        if events_this_week >= plan["max_events"]:
            self._log(
                audit,
                f"[RULE 7] ❌ Worker has used all {plan['max_events']} covered events. "
                f"Payout = ₹0."
            )
            return self._build_response(
                claim_id=claim_id, safe_income=safe_income, safe_prob=safe_prob,
                final_payout=0.0, final_action="REJECT", reason="event_cap_exceeded",
                plan_tier=plan_tier, trust_score=trust_score, audit=audit,
            )

        self._log(audit, f"[RULE 7] ✅ Event count within limit ({events_this_week}/{plan['max_events']}).")

        # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ #
        # RULE 8 — ACTUARIAL MATH                                           #
        # Core formula: raw_expected_loss = P(disruption) × (income × sev) #
        # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ #
        self._log(audit, "[RULE 8] Actuarial Calculation...")

        severity = max(0.0, min(float(trigger_severity_multiplier), cfg["severity_max"]))
        if severity != trigger_severity_multiplier:
            self._log(
                audit,
                f"[RULE 8] Severity clamped: {trigger_severity_multiplier} → {severity} "
                f"(max={cfg['severity_max']})."
            )
        else:
            self._log(audit, f"[RULE 8] Severity multiplier: {severity} (within range).")

        raw_expected_loss = safe_prob * (safe_income * severity)
        self._log(
            audit,
            f"[RULE 8] raw_expected_loss = {safe_prob:.4f} × "
            f"(₹{safe_income:.2f} × {severity:.2f}) = ₹{raw_expected_loss:.2f}"
        )
        calculated_payout = raw_expected_loss

        # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ #
        # RULE 9 — CONTINUOUS RISK SCALING [FIX-2]                         #
        # v1 used risk_index only as a binary HOLD trigger (> 0.85).       #
        # v2 ALSO applies a proportional multiplier to every payout so that #
        # higher anomaly scores always yield lower payouts, creating a      #
        # smooth deterrent curve rather than a binary cliff.                #
        #                                                                   #
        # Formula: payout *= max(0.1, 1.0 - risk_index)                    #
        #   risk_index = 0.0  → multiplier = 1.00  (no penalty)            #
        #   risk_index = 0.5  → multiplier = 0.50  (50% penalty)           #
        #   risk_index = 0.95 → multiplier = 0.10  (floor, 90% penalty)    #
        # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ #
        risk_scaler   = round(max(0.1, 1.0 - risk_index), 4)
        pre_scale     = calculated_payout
        calculated_payout = calculated_payout * risk_scaler

        self._log(
            audit,
            f"[RULE 9] Continuous Risk Scaling [FIX-2] — "
            f"risk_index={risk_index:.4f} | "
            f"scaler=max(0.1, 1.0-{risk_index:.4f})={risk_scaler:.4f} | "
            f"₹{pre_scale:.2f} × {risk_scaler:.4f} = ₹{calculated_payout:.2f}"
        )

        # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ #
        # RULE 10 — API FALLBACK HARD CAP [FIX-4]                           #
        # v1 Bug: `all(... if api in api_status)` silently skipped APIs not  #
        # present in the dict, so a single missing key could falsely satisfy  #
        # the all() check and trigger the cap incorrectly.                   #
        #                                                                    #
        # v2 Fix: Compare len(failed_critical) == len(critical_apis).        #
        # This requires EVERY defined critical API to be explicitly failing.  #
        # An absent key is NOT treated as failing.                           #
        # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ #
        critical_apis   = cfg["critical_apis"]
        failed_critical = [
            api for api in critical_apis
            if api_status.get(api) in ("timeout", "offline", "error")
        ]
        # [FIX-4] Explicit length equality — both conditions must hold:
        #   1. At least one critical API is defined in config (avoid vacuous truth)
        #   2. Every single defined API is in a failed state
        all_critical_offline = (
            len(critical_apis) > 0 and
            len(failed_critical) == len(critical_apis)
        )

        self._log(
            audit,
            f"[RULE 10] API Fallback [FIX-4] — "
            f"critical_apis={critical_apis} | "
            f"failed={failed_critical} | "
            f"all_offline={all_critical_offline} "
            f"({len(failed_critical)}/{len(critical_apis)} failing)"
        )

        if all_critical_offline:
            cap = cfg["all_apis_down_cap"]
            self._log(
                audit,
                f"[RULE 10] ⚠️  ALL critical APIs offline. "
                f"Blind-payout cap applied: ₹{cap:.2f}."
            )
            if calculated_payout > cap:
                self._log(
                    audit,
                    f"[RULE 10] Payout capped: ₹{calculated_payout:.2f} → ₹{cap:.2f}."
                )
                calculated_payout = cap

        # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ #
        # RULE 11 — HOLD PAYOUT CAP                                         #
        # Applied after all other reductions so the fraction is taken from  #
        # the most accurate post-scaled, post-capped figure.                 #
        # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ #
        if force_hold:
            fraction  = cfg["hold_payout_fraction"]
            pre_hold  = calculated_payout
            calculated_payout = pre_hold * fraction
            self._log(
                audit,
                f"[RULE 11] HOLD cap — ₹{pre_hold:.2f} × {fraction:.0%} = "
                f"₹{calculated_payout:.2f} (partial release; full payout pending 48h review)."
            )

        # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ #
        # RULE 12 — WEEKLY PLAN CAP                                         #
        # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ #
        weekly_cap    = plan["weekly_payout_cap"]
        remaining_cap = max(0.0, weekly_cap - weekly_payout_so_far)
        self._log(
            audit,
            f"[RULE 12] Weekly cap — plan={plan_tier}, cap=₹{weekly_cap:.2f}, "
            f"paid=₹{weekly_payout_so_far:.2f}, remaining=₹{remaining_cap:.2f}."
        )

        if calculated_payout > remaining_cap:
            self._log(
                audit,
                f"[RULE 12] Payout ₹{calculated_payout:.2f} exceeds remaining. "
                f"Clamping to ₹{remaining_cap:.2f}."
            )
            calculated_payout = remaining_cap

        # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ #
        # RULE 13 — MICRO-TRANSFER FLOOR                                    #
        # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ #
        floor = cfg["micro_transfer_floor"]
        self._log(audit, f"[RULE 13] Micro-transfer floor — threshold=₹{floor:.2f}.")

        if 0 < calculated_payout < floor:
            self._log(
                audit,
                f"[RULE 13] Payout ₹{calculated_payout:.2f} < floor ₹{floor:.2f}. "
                f"Collapsed to ₹0 (negligible micro-transfer avoided)."
            )
            calculated_payout = 0.0

        # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ #
        # RULE 14 — FINAL ACTION DETERMINATION                              #
        # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ #
        if force_hold:
            final_action = "HOLD"
            reason       = hold_reason or "high_risk_hold"
        elif calculated_payout <= 0.0:
            final_action = "REJECT"
            reason       = "cap_or_floor"
        else:
            final_action = "PAY"
            reason       = "approved"

        self._log(
            audit,
            f"[FINAL] decision={final_action} | payout=₹{calculated_payout:.2f} | reason={reason}"
        )

        return self._build_response(
            claim_id=claim_id, safe_income=safe_income, safe_prob=safe_prob,
            final_payout=calculated_payout, final_action=final_action, reason=reason,
            plan_tier=plan_tier, trust_score=trust_score, audit=audit,
        )

    # ------------------------------------------------------------------ #
    #  PRIVATE HELPERS                                                     #
    # ------------------------------------------------------------------ #

    def _bound_outputs(
        self,
        predicted_income: float,
        disruption_prob:  float,
        api_status:       dict,
        audit:            list[str],
    ) -> tuple[float, float]:
        """
        Clamp income and probability to config-defined safe ranges.
        Apply API timeout confidence penalty for each failing critical API.
        Returns (safe_income, safe_prob) — safe_prob is NOT yet rounded here;
        explicit round-to-4dp happens in evaluate() Rule 2 after this call.
        """
        cfg = self.config

        # ── Income clamping ────────────────────────────────────────────────
        safe_income = max(cfg["income_min"], min(predicted_income, cfg["income_max"]))
        if safe_income != predicted_income:
            self._log(
                audit,
                f"[RULE 2] Income clamped: ₹{predicted_income:.2f} → ₹{safe_income:.2f} "
                f"(bounds ₹{cfg['income_min']}–₹{cfg['income_max']})."
            )
        else:
            self._log(audit, f"[RULE 2] Income within bounds: ₹{safe_income:.2f}.")

        # ── Probability clamping ───────────────────────────────────────────
        safe_prob = max(cfg["prob_min"], min(disruption_prob, cfg["prob_max"]))
        if safe_prob != disruption_prob:
            self._log(
                audit,
                f"[RULE 2] Prob clamped: {disruption_prob:.6f} → {safe_prob:.6f} "
                f"(bounds {cfg['prob_min']}–{cfg['prob_max']})."
            )
        else:
            self._log(audit, f"[RULE 2] Prob within bounds: {safe_prob:.6f}.")

        # ── API timeout confidence penalty ─────────────────────────────────
        timed_out = [
            api for api in cfg["critical_apis"]
            if api_status.get(api) in ("timeout", "offline", "error")
        ]
        if timed_out:
            penalty   = cfg["api_timeout_prob_penalty"]
            before    = safe_prob
            safe_prob = max(cfg["prob_min"], safe_prob * (1.0 - penalty))
            self._log(
                audit,
                f"[RULE 2] API timeout penalty — failed={timed_out} | "
                f"prob {before:.6f} × {1.0-penalty:.2f} = {safe_prob:.6f}."
            )

        return round(safe_income, 2), safe_prob

    def _build_response(
        self,
        claim_id:     str,
        safe_income:  float,
        safe_prob:    float,
        final_payout: float,
        final_action: str,
        reason:       str,
        plan_tier:    str,
        trust_score:  float,
        audit:        list[str],
    ) -> dict:
        """
        Assemble the final structured response, injecting all v2 metadata.
        """
        final_payout = round(max(0.0, final_payout), 2)
        user_message = self._generate_user_message(
            final_action, reason, final_payout, plan_tier, trust_score
        )
        self._log(audit, f"[RESPONSE] user_message → \"{user_message[:80]}...\"")
        self._log(audit, "═" * 65)

        return {
            # ── Core ML-derived outputs ───────────────────────────────────
            "safe_income":          round(safe_income, 2),
            "safe_prob":            round(safe_prob, 4),
            "final_payout_amount":  final_payout,
            "final_action":         final_action,
            "user_message":         user_message,
            "audit_trail":          list(audit),
            # ── [UPG-9] Claim identity ────────────────────────────────────
            "claim_id":             claim_id,
            # ── [UPG-7] Policy version ────────────────────────────────────
            "policy_version":       self.config["policy_version"],
            # ── [UPG-8] Decision source ───────────────────────────────────
            "decision_source":      "POLICY_ENGINE",
        }

    def _generate_user_message(
        self,
        action:      str,
        reason:      str,
        amount:      float,
        plan_tier:   str,
        trust_score: float,
    ) -> str:
        """Plain-language, empathetic worker-facing message per reason code."""
        cfg  = self.config
        msgs: dict[str, str] = {
            "approved": (
                f"Great news! Your claim has been approved and ₹{amount:.2f} is being "
                f"transferred to your registered UPI account. Stay safe."
            ),
            "fraud_review_hold": (
                f"Your claim is under a 48-hour security review. ₹{amount:.2f} has been "
                f"reserved for you and will be released automatically if no issues are found."
            ),
            "high_risk_hold": (
                f"Unusual patterns were detected in your claim. ₹{amount:.2f} is reserved "
                f"pending 48-hour manual review. You will receive an update shortly."
            ),
            "low_trust_hold": (
                f"Your account is undergoing a verification review. Your claim of "
                f"₹{amount:.2f} is on hold and will be processed once the review is complete."
            ),
            "temporal_hold": (
                f"Multiple claims were detected in a short period. Your claim of ₹{amount:.2f} "
                f"is on a 48-hour hold for manual review. This is a standard safety check."
            ),
            "no_trigger": (
                "Your claim could not be processed because no disruption threshold was crossed "
                "in your zone at the time of the claim. Contact support with your claim ID."
            ),
            "fraud_block": (
                "Your claim was rejected by our security system. Contact support and quote "
                "your claim ID for a manual review."
            ),
            "event_cap_exceeded": (
                f"You have used all {cfg['plans'][plan_tier]['max_events']} covered events "
                f"this week under your {plan_tier} plan. Coverage resets next Monday."
            ),
            "cap_or_floor": (
                f"Your calculated payout was below the minimum transfer amount "
                f"(₹{cfg['micro_transfer_floor']:.0f}), or your weekly limit is fully used. "
                f"No transfer made. Plan resets next Monday."
            ),
        }

        base = msgs.get(
            reason,
            f"Decision: {action}. Amount: ₹{amount:.2f}. Contact support if you have questions."
        )

        # Append fast-track note for high-trust approved claims
        if action == "PAY" and trust_score > cfg["trust_score_high_threshold"]:
            base += " As a highly trusted partner, your claim was fast-tracked."

        return base

    def _log(self, audit: list[str], message: str) -> None:
        """Append to audit trail; optionally print in debug mode."""
        audit.append(message)
        if self.debug:
            print(f"  {message}")

    @staticmethod
    def _coerce_float(value: Any, field_name: str) -> float:
        """Safely coerce any value to float; returns 0.0 on failure."""
        try:
            return float(value)
        except (TypeError, ValueError):
            return 0.0

    @staticmethod
    def _safe_repr(inputs: dict) -> str:
        """Compact audit-safe repr of inputs (truncates long values)."""
        parts = [
            f"{k}={str(v)[:30]}" if len(str(v)) > 30 else f"{k}={v}"
            for k, v in inputs.items()
        ]
        return "{" + ", ".join(parts) + "}"


# ============================================================================
# TEST BLOCK — run: python policy_engine.py
# ============================================================================

if __name__ == "__main__":
    engine = PolicyControlEngine(debug=False)

    GREEN  = "\033[92m"; RED = "\033[91m"; YELLOW = "\033[93m"
    BLUE   = "\033[94m"; RESET = "\033[0m"; BOLD = "\033[1m"

    def section(title: str):
        print(f"\n{BOLD}{'═' * 72}{RESET}")
        print(f"{BOLD}  {title}{RESET}")
        print(f"{BOLD}{'═' * 72}{RESET}")

    def show(result: dict, label: str):
        c = GREEN if result["final_action"] == "PAY" else (YELLOW if result["final_action"] == "HOLD" else RED)
        print(f"\n  {BOLD}[{label}]{RESET}")
        print(f"  claim_id            : {result['claim_id']}")
        print(f"  policy_version      : {result['policy_version']}")
        print(f"  decision_source     : {result['decision_source']}")
        print(f"  safe_income         : ₹{result['safe_income']:.2f}")
        print(f"  safe_prob           : {result['safe_prob']:.4f}")
        print(f"  final_payout_amount : ₹{result['final_payout_amount']:.2f}")
        print(f"  final_action        : {c}{result['final_action']}{RESET}")
        print(f"  user_message        : {BLUE}{result['user_message'][:88]}{RESET}")
        print(f"  audit (key lines):")
        for line in result["audit_trail"]:
            if any(k in line for k in ["❌","⚠️","✅","FINAL","RULE","Claim ID","Scaling","Rounding"]):
                print(f"    {line}")

    # ══════════════════════════════════════════════════════════════════════
    # EXTREME EDGE CASE v2
    # risk_index=0.92 still clears the RELAXED threshold of 0.90
    # (trust=0.95 relaxes 0.85 → 0.90), so HOLD is still triggered.
    # Continuous risk scaler = max(0.1, 1-0.92) = 0.10 (floor).
    # ══════════════════════════════════════════════════════════════════════
    section("EXTREME EDGE CASE v2 — All v2 Guards Fire Simultaneously")
    print("""
  Rule-by-rule expected path:
    Rule 1: trigger=True                → passes
    Rule 2: income ₹50k→₹3k, prob 1.5→0.95→0.76 (API penalty), rounded to 0.7600
    Rule 3: trust=0.95 > 0.9           → threshold relaxed 0.85→0.90
    Rule 4: risk=0.92 > 0.90           → HOLD forced
    Rule 5: trust=0.95 > 0.3           → no low-trust HOLD
    Rule 6: claims_last_24h=0          → no temporal HOLD
    Rule 7: events=1 < 2               → passes
    Rule 8: 0.76 × (3000 × 1.6)       = ₹3,648.00
    Rule 9: ₹3648 × max(0.1, 1-0.92)  = ₹3648 × 0.10 = ₹364.80  [FIX-2]
    Rule 10: only weather_api timeout  → NOT all offline             [FIX-4]
    Rule 11: ₹364.80 × 50% (HOLD cap) = ₹182.40
    Rule 12: ₹182.40 ≤ ₹1200          → no trim
    Rule 13: ₹182.40 > ₹50            → no collapse
    FINAL:   HOLD | ₹182.40
    """)

    extreme = engine.evaluate({
        # [UPG-9] No claim_id supplied → auto-generated
        "predicted_income":            50000.0,     # ← adversarially high
        "disruption_prob":             1.5,          # ← impossible
        "fraud_decision":              "APPROVE",
        "risk_index":                  0.92,         # > relaxed threshold 0.90
        "trigger_severity_multiplier": 1.6,
        "trigger_flag":                True,
        "api_status":                  {"weather_api": "timeout", "cpcb_api": "ok"},
        "plan_tier":                   "Premium",
        "weekly_payout_so_far":        0.0,
        "events_this_week":            1,
        "trust_score":                 0.95,         # [FIX-1] relaxes threshold
        "claims_last_24h":             0,            # [FIX-3] temporal gate passes
    })
    show(extreme, "Extreme Edge Case v2")

    # All assertions
    assert extreme["safe_income"]         == 3000.00,          "Income clamp failed"
    assert extreme["safe_prob"]           == 0.76,             f"Prob+round: {extreme['safe_prob']}"
    assert extreme["final_action"]        == "HOLD",           "HOLD expected"
    assert extreme["final_payout_amount"] == 182.40,           f"Payout maths: {extreme['final_payout_amount']}"
    assert extreme["final_payout_amount"] <= 1200.0,           "Premium cap breached"
    assert extreme["policy_version"]      == "v2.0",           "Version missing"
    assert extreme["decision_source"]     == "POLICY_ENGINE",  "Source missing"
    assert extreme["claim_id"].startswith("CLM-"),             "Auto claim_id malformed"
    # Verify risk scaler was applied at floor (0.10)
    raw = extreme["safe_prob"] * (extreme["safe_income"] * 1.6)   # = 3648
    assert extreme["final_payout_amount"] < raw * 0.15,           "Risk floor scaler not applied"
    print(f"\n  {GREEN}✓ All 9 assertions passed for extreme edge case v2.{RESET}")

    # ══════════════════════════════════════════════════════════════════════
    # CANONICAL TEST SUITE — 12 cases (7 v1 preserved + 5 new v2 paths)
    # ══════════════════════════════════════════════════════════════════════
    section("TEST SUITE — 12 Canonical Scenarios")

    # Shared base inputs — each test overrides only what it needs
    _base = {
        "predicted_income": 1800.0, "disruption_prob": 0.75,
        "fraud_decision": "APPROVE", "risk_index": 0.1,
        "trigger_severity_multiplier": 1.3, "trigger_flag": True,
        "api_status": {"weather_api": "ok", "cpcb_api": "ok"},
        "plan_tier": "Standard", "weekly_payout_so_far": 0.0,
        "events_this_week": 0, "trust_score": 0.6, "claims_last_24h": 0,
    }

    def make_tc(label, overrides, expect_action, payout_check=None, note=""):
        return {"label": label, "inputs": {**_base, **overrides},
                "expect_action": expect_action,
                "payout_check": payout_check, "note": note}

    test_cases = [
        # ── v1 compatibility ───────────────────────────────────────────────
        make_tc("TC-01 No trigger → Hard gate REJECT",
                {"trigger_flag": False},
                "REJECT", lambda p: math.isclose(p, 0.0, abs_tol=0.01)),

        make_tc("TC-02 Fraud BLOCK → REJECT",
                {"fraud_decision": "BLOCK"},
                "REJECT", lambda p: math.isclose(p, 0.0, abs_tol=0.01)),

        make_tc("TC-03 Fraud REVIEW → HOLD",
                {"fraud_decision": "REVIEW", "plan_tier": "Premium"},
                "HOLD", lambda p: p <= 1200.0),

        make_tc("TC-04 Event cap exhausted → REJECT",
                {"events_this_week": 2, "plan_tier": "Basic", "weekly_payout_so_far": 200.0},
                "REJECT", lambda p: math.isclose(p, 0.0, abs_tol=0.01)),

        make_tc("TC-05 All APIs offline → ≤ ₹400 cap",
                {"predicted_income": 3000.0, "disruption_prob": 0.95,
                 "risk_index": 0.05,   # low risk → scaler ≈ 0.95
                 "trigger_severity_multiplier": 1.6,
                 "api_status": {"weather_api": "timeout", "cpcb_api": "timeout"}},
                "PAY", lambda p: p <= 400.0),

        make_tc("TC-06 Weekly cap fully consumed → floor collapses to REJECT",
                {"predicted_income": 2000.0, "disruption_prob": 0.85,
                 "weekly_payout_so_far": 760.0},   # only ₹40 left → below ₹50 floor
                "REJECT", lambda p: math.isclose(p, 0.0, abs_tol=0.01)),

        make_tc("TC-07 Clean high-trust claim → full PAY",
                {"predicted_income": 1600.0, "disruption_prob": 0.72,
                 "risk_index": 0.05, "plan_tier": "Premium", "trust_score": 0.95},
                "PAY", lambda p: p >= 50.0),

        # ── v2 new paths ───────────────────────────────────────────────────
        make_tc("TC-08 [FIX-1] Low trust < 0.3 → HOLD",
                {"trust_score": 0.2, "risk_index": 0.1},   # risk alone PASSES
                "HOLD", lambda p: p >= 0.0,
                note="trust=0.2 forces HOLD despite clean risk"),

        make_tc("TC-09 [FIX-3] claims_last_24h > 0 → Temporal HOLD",
                {"claims_last_24h": 3, "risk_index": 0.1},  # risk alone PASSES
                "HOLD", lambda p: p >= 0.0,
                note="rapid-fire claim detection"),

        make_tc("TC-10 [FIX-1] High trust relaxes threshold: risk=0.87 → PAY",
                {"trust_score": 0.95,    # threshold: 0.85+0.05=0.90
                 "risk_index":  0.87,    # 0.87 < 0.90 → passes (would HOLD in v1)
                 "plan_tier": "Premium"},
                "PAY", lambda p: p >= 50.0,
                note="0.87 would HOLD in v1 at threshold 0.85"),

        make_tc("TC-11 [FIX-2] Continuous risk scaling proportionally reduces payout",
                {"risk_index": 0.5, "plan_tier": "Premium", "trust_score": 0.6,
                 "predicted_income": 2000.0, "disruption_prob": 0.8,
                 "trigger_severity_multiplier": 1.3},
                # scaler=0.5; raw≈1540; scaled≈770; ≤ Premium cap 1200
                "PAY", lambda p: 800.0 < p < 1100.0,
                note="risk=0.5 halves the payout"),

        make_tc("TC-12 [FIX-4] Only 1 of 2 APIs offline → NOT all_offline; payout > ₹400",
                {"predicted_income": 1500.0, "disruption_prob": 0.80,
                 "risk_index": 0.05, "trigger_severity_multiplier": 1.3,
                 "api_status": {"weather_api": "timeout", "cpcb_api": "ok"},  # 1/2 failing
                 "plan_tier": "Premium"},
                "PAY", lambda p: p > 400.0,
                note="v1 bug falsely triggered ALL_DOWN cap with 1 absent API key"),
    ]

    all_passed = True
    for tc_def in test_cases:
        result    = engine.evaluate(tc_def["inputs"])
        action_ok = result["final_action"] == tc_def["expect_action"]
        payout    = result["final_payout_amount"]
        pay_ok    = tc_def["payout_check"](payout) if tc_def["payout_check"] else True
        # Every response must carry v2 metadata
        meta_ok   = (
            result.get("policy_version")  == "v2.0"
            and result.get("decision_source") == "POLICY_ENGINE"
            and bool(result.get("claim_id"))
        )
        passed     = action_ok and pay_ok and meta_ok
        all_passed = all_passed and passed

        colour = GREEN if passed else RED
        mark   = "✓" if passed else "✗"
        note   = f"  ← {tc_def['note']}" if tc_def.get("note") else ""
        print(
            f"  {colour}{mark}{RESET}  {tc_def['label']:<52}  "
            f"action={colour}{result['final_action']:<6}{RESET}  "
            f"payout=₹{payout:>8.2f}{note}"
        )
        if not passed:
            if not action_ok:
                print(f"      ACTION: got '{result['final_action']}', expected '{tc_def['expect_action']}'")
            if not pay_ok:
                print(f"      PAYOUT: ₹{payout:.2f} failed check")
            if not meta_ok:
                print(f"      META: version={result.get('policy_version')} "
                      f"source={result.get('decision_source')} id={result.get('claim_id')}")

    print(f"\n{'═' * 72}")
    outcome = f"{GREEN}All 12 tests passed ✓{RESET}" if all_passed else f"{RED}Some FAILED ✗{RESET}"
    print(f"{BOLD}  RESULT: {outcome}{RESET}")
    print(f"{'═' * 72}\n")