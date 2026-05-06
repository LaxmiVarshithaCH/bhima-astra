# fusion_engine.py
# BHIMA ASTRA — Reason Fusion Engine (Explainable AI Layer)

from __future__ import annotations

# ---------------------------------------------------------------------------
# 1. TRANSLATION & CATEGORY MAPPING
# ---------------------------------------------------------------------------

FEATURE_TRANSLATIONS: dict[str, str] = {
    # Location
    "gps_tower_delta":          "A significant discrepancy was detected between your GPS location and the nearest cell tower.",
    "gps_mismatch":             "Your reported location could not be verified against network data.",
    # Movement
    "accelerometer_variance":   "Unusual movement patterns were detected at the time of the incident.",
    "no_motion":                "No device motion was recorded during the reported incident window.",
    # Timing
    "claim_response_time_sec":  "The claim was filed unusually quickly after the reported incident.",
    "claims_last_24h":          "Multiple claims were submitted within a 24-hour period.",
    # Network / Graph
    "cluster_score":            "Your claim is associated with a high-risk network cluster.",
    "network_risk_flag":        "A network-level risk flag was raised based on connected entities.",
    # Identity / Device
    "device_id_mismatch":       "The submitting device does not match the registered account device.",
    "sim_swap_flag":            "A recent SIM card change was detected on the registered number.",
    # Behavioral
    "velocity_flag":            "An unusually high transaction or claim velocity was detected.",
    "night_hour_flag":          "Activity occurred during an atypical off-hours window.",
    # Policy
    "policy_age_days":          "The policy is relatively new, which is factored into the risk assessment.",
    "coverage_gap_flag":        "A lapse in coverage was detected prior to the claim date.",
    # Financial
    "claim_amount_percentile":  "The claimed amount is significantly higher than the typical range for this category.",
    "risk_index":               "An elevated overall risk index was computed for this claim.",
}

CATEGORY_MAP: dict[str, str] = {
    # LOCATION
    "gps_tower_delta":          "LOCATION",
    "gps_mismatch":             "LOCATION",
    # MOVEMENT
    "accelerometer_variance":   "MOVEMENT",
    "no_motion":                "MOVEMENT",
    # TIMING
    "claim_response_time_sec":  "TIMING",
    "claims_last_24h":          "TIMING",
    # NETWORK
    "cluster_score":            "NETWORK",
    "network_risk_flag":        "NETWORK",
    # IDENTITY
    "device_id_mismatch":       "IDENTITY",
    "sim_swap_flag":            "IDENTITY",
    # BEHAVIORAL
    "velocity_flag":            "BEHAVIORAL",
    "night_hour_flag":          "BEHAVIORAL",
    # POLICY
    "policy_age_days":          "POLICY_AGE",
    "coverage_gap_flag":        "POLICY_COVERAGE",
    # FINANCIAL
    "claim_amount_percentile":  "FINANCIAL",
    "risk_index":               "RISK_INDEX",
}


# ---------------------------------------------------------------------------
# 2. FUSION ENGINE
# ---------------------------------------------------------------------------

class ExplanationFusionEngine:
    """
    Intercepts raw ML, Graph, Rule, and Policy signals and fuses them
    into a structured, human-readable Audit Object.
    """

    # -----------------------------------------------------------------------
    # Internal helpers
    # -----------------------------------------------------------------------

    @staticmethod
    def _map_tone(trust_score: float) -> str:
        """Rule B — tone mapping based on normalised trust_score."""
        if trust_score > 0.70:
            return "soft, empathetic, and reassuring"
        if trust_score >= 0.40:
            return "neutral, professional, and factual"
        return "strict, firm, and definitive"

    @staticmethod
    def _resolve_category(feature: str) -> str:
        """Return the semantic category for a feature, falling back to the feature name itself."""
        return CATEGORY_MAP.get(feature, feature.upper())

    @staticmethod
    def _translate(feature: str) -> str:
        """Return a human-readable reason string for a feature."""
        return FEATURE_TRANSLATIONS.get(
            feature,
            "An unusual pattern was detected in your claim activity.",
        )

    # -----------------------------------------------------------------------
    # Core public method
    # -----------------------------------------------------------------------

    def build_audit_object(self, inputs: dict) -> dict:  # noqa: C901  (complexity is intentional)
        """
        Build and return a strict Audit Object dictionary.

        Parameters
        ----------
        inputs : dict
            Raw signal payload from upstream pipeline components.

        Returns
        -------
        dict
            Structured audit object matching the TARGET OUTPUT SCHEMA.
        """

        # -- Safe extraction with defaults (Rule K) --------------------------
        final_action:    str   = inputs.get("final_action", "HOLD")
        fraud_decision:  str   = inputs.get("fraud_decision", "REVIEW")
        payout_amount:   float = float(inputs.get("payout_amount", 0.0))
        trust_score:     float = float(inputs.get("trust_score", 0.5))
        cluster_score:   float = float(inputs.get("cluster_score", 0.0))
        cluster_size:    int   = int(inputs.get("cluster_size", 0))
        risk_index:      float = float(inputs.get("risk_index", 0.0))
        policy_reason:   str   = inputs.get("policy_reason", "")
        policy_context:  str   = policy_reason if policy_reason else "Policy-based evaluation applied."
        rule_flags:      list  = inputs.get("rule_flags", [])
        graph_signals:   list  = inputs.get("graph_signals", [])
        shap_explanation: list = inputs.get("shap_explanation", [])

        # -- Rule A: Happy Path -----------------------------------------------
        if final_action == "PAY":
            return {
                "final_decision":         final_action,
                "payout_amount":          payout_amount,
                "explanation_confidence": "HIGH",
                "audit_trail_technical": {
                    "ml_drivers":    [],
                    "graph_drivers": [],
                    "rule_drivers":  [],
                },
                "user_facing_reasons": [
                    "Your claim successfully passed all verification and trust checks."
                ],
                "policy_context":  policy_context,
                "suggested_tone":  self._map_tone(trust_score),
            }

        # -- Rule B: Tone Mapping --------------------------------------------
        suggested_tone = self._map_tone(trust_score)

        # -- Signal accumulators ---------------------------------------------
        user_facing_reasons: list[str] = []
        seen_categories:     set[str]  = set()

        audit_rule_drivers:  list[str] = []
        audit_graph_drivers: list[str] = []
        audit_ml_drivers:    list[str] = []

        signal_strength: int = 0  # Rule F

        # -- Rule C Priority 1: RULES ----------------------------------------
        for flag in rule_flags:
            feature  = str(flag)
            category = self._resolve_category(feature)
            audit_rule_drivers.append(feature)           # Rule I — raw flag
            signal_strength += 1                         # Fix: 1 pt per rule to avoid overconfidence

            if category not in seen_categories:
                seen_categories.add(category)
                user_facing_reasons.append(self._translate(feature))

        # -- Rule C Priority 2: GRAPH ----------------------------------------
        # Rule H — include graph reasoning only under specific conditions
        include_graph = (cluster_score > 0.70) or (cluster_size > 5)

        if include_graph:
            if not graph_signals:
                graph_signals = ["cluster_score"]  # Fallback consistency
            
            for signal in graph_signals:
                feature  = str(signal)
                category = self._resolve_category(feature)

                # Rule I — always include cluster_score in graph_drivers
                driver_str = feature
                if feature == "cluster_score":
                    driver_str = f"cluster_score ({cluster_score:.3f})"
                audit_graph_drivers.append(driver_str)

                signal_strength += 2                     # Rule F — Graph = 2 pts

                if category not in seen_categories:
                    seen_categories.add(category)
                    user_facing_reasons.append(self._translate(feature))

            # Always attach cluster_score to graph_drivers when graph is active
            if not any("cluster_score" in d for d in audit_graph_drivers):
                audit_graph_drivers.append(f"cluster_score ({cluster_score:.3f})")

        # -- Rule C Priority 3: SHAP (ML) ------------------------------------
        # Rule D — filter: effect == "INCREASED", top-3 only
        # Rule J — shap_explanation may be missing or empty; handle gracefully
        increased_shap = [
            entry for entry in shap_explanation
            if isinstance(entry, dict) and entry.get("effect", "").upper() == "INCREASED"
        ]
        # Sort by absolute impact BEFORE taking top 3
        top_shap = sorted(
            increased_shap,
            key=lambda x: abs(float(x.get("impact_log_odds", 0))),
            reverse=True
        )[:3]

        for entry in top_shap:
            feature = str(entry.get("feature", "unknown"))
            impact  = entry.get("impact_log_odds", 0.0)
            sign    = "+" if float(impact) >= 0 else ""

            # Rule I — ml_drivers format: "feature_name (+/-impact)"
            audit_ml_drivers.append(f"{feature} ({sign}{float(impact):.2f})")

            signal_strength += 1                         # Rule F — SHAP = 1 pt

            category = self._resolve_category(feature)
            if category not in seen_categories:
                seen_categories.add(category)
                user_facing_reasons.append(self._translate(feature))

        # -- Rule E: Fallback Reason & Rule F: Confidence Calculation --------
        explanation_confidence: str
        if not user_facing_reasons:
            user_facing_reasons = ["Claim decision based on overall risk evaluation."]
            explanation_confidence = "LOW"
        else:
            if fraud_decision == "BLOCK" or signal_strength >= 3:
                explanation_confidence = "HIGH"
            elif signal_strength > 0:
                explanation_confidence = "MEDIUM"
            else:
                explanation_confidence = "LOW"
                
        # -- Add Decision Prefix (Moved OUTSIDE the else block) --------------
        if final_action == "REJECT":
            user_facing_reasons.insert(0, "Your claim could not be approved due to high-risk indicators.")
        elif final_action == "HOLD":
            user_facing_reasons.insert(0, "Your claim requires further review due to risk signals.")
        # -- Rule L: Strict schema output ------------------------------------
        return {
            "final_decision":         final_action,
            "payout_amount":          payout_amount,
            "explanation_confidence": explanation_confidence,
            "audit_trail_technical": {
                "ml_drivers":    audit_ml_drivers,
                "graph_drivers": audit_graph_drivers,
                "rule_drivers":  audit_rule_drivers,
            },
            "user_facing_reasons": user_facing_reasons,
            "policy_context": policy_context,
            "suggested_tone":      suggested_tone,
        }


# ---------------------------------------------------------------------------
# 3. TEST BLOCK — mocked REJECT scenario
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import json

    engine = ExplanationFusionEngine()

    # -------------------------------------------------------------------
    # Scenario: Rejected claim with overlapping categories (dedup test)
    # and 5 SHAP entries where 2 are "DECREASED" (filter test) and
    # the remaining 3 "INCREASED" entries include a category already
    # seen from a rule flag (dedup test).
    # -------------------------------------------------------------------
    mock_inputs = {
        # Authoritative pipeline outputs (Rule G)
        "final_action":   "REJECT",
        "fraud_decision": "BLOCK",
        "payout_amount":  0.0,

        # Normalized scores
        "trust_score":   0.25,   # → strict tone
        "cluster_score": 0.85,   # > 0.70 → graph signals active (Rule H)
        "cluster_size":  8,      # > 5 (also satisfies Rule H independently)
        "risk_index":    0.91,

        # Rule flags (Priority 1) — two flags, same category LOCATION
        # Expected: only ONE location reason reaches user_facing_reasons
        "rule_flags": [
            "gps_tower_delta",     # category: LOCATION  ← added first
            "gps_mismatch",        # category: LOCATION  ← DUPLICATE → skipped
            "velocity_flag",       # category: BEHAVIORAL ← added
        ],

        # Graph signals (Priority 2)
        "graph_signals": [
            "network_risk_flag",   # category: NETWORK ← added
            "cluster_score",       # category: NETWORK ← DUPLICATE → skipped in user reasons
        ],

        # Policy context
        "policy_reason": (
            "Policy clause 4.2.1 applies: Claims filed within 48 hours of policy "
            "inception are subject to enhanced scrutiny."
        ),

        # SHAP entries (Priority 3)
        # Rule D: only INCREASED, top-3 max
        # Entry 1 — INCREASED, category TIMING          ← should be added
        # Entry 2 — DECREASED                           ← filtered out
        # Entry 3 — INCREASED, category LOCATION        ← DUPLICATE (seen from rules) → skipped in user reasons
        # Entry 4 — INCREASED, category FINANCIAL       ← should be added (2nd INCREASED kept)
        # Entry 5 — INCREASED, category IDENTITY        ← should be added (3rd INCREASED kept, top-3 limit)
        # Entry 6 — INCREASED, category BEHAVIORAL      ← beyond top-3 INCREASED cap → not processed
        "shap_explanation": [
            {"feature": "claim_response_time_sec", "effect": "INCREASED", "impact": 0.18},
            {"feature": "accelerometer_variance",  "effect": "DECREASED", "impact": -0.07},
            {"feature": "gps_tower_delta",         "effect": "INCREASED", "impact": 0.14},
            {"feature": "claim_amount_percentile", "effect": "INCREASED", "impact": 0.22},
            {"feature": "device_id_mismatch",      "effect": "INCREASED", "impact": 0.11},
            {"feature": "night_hour_flag",         "effect": "INCREASED", "impact": 0.09},
        ],
    }

    result = engine.build_audit_object(mock_inputs)

    print("=" * 72)
    print("BHIMA ASTRA — Reason Fusion Engine Output")
    print("=" * 72)
    print(json.dumps(result, indent=2))
    print("=" * 72)

    # -------------------------------------------------------------------
    # Assertions to prove correctness
    # -------------------------------------------------------------------
    reasons = result["user_facing_reasons"]

    # Deduplication: only one LOCATION reason should appear
    location_reasons = [
        r for r in reasons
        if "GPS" in r or "location" in r.lower()
    ]
    assert len(location_reasons) == 1, (
        f"FAIL: Expected 1 LOCATION reason, got {len(location_reasons)}: {location_reasons}"
    )
    print("✓ DEDUPLICATION — Only 1 LOCATION reason in user_facing_reasons.")

    # SHAP filter: only INCREASED entries processed
    ml_drivers = result["audit_trail_technical"]["ml_drivers"]
    assert all("accelerometer_variance" not in d for d in ml_drivers), (
        "FAIL: DECREASED SHAP feature 'accelerometer_variance' must be excluded."
    )
    print("✓ SHAP FILTER  — DECREASED features absent from ml_drivers.")

    # SHAP top-3 cap
    assert len(ml_drivers) <= 3, (
        f"FAIL: Expected at most 3 ml_drivers, got {len(ml_drivers)}: {ml_drivers}"
    )
    print(f"✓ SHAP TOP-3   — ml_drivers count: {len(ml_drivers)} (≤ 3).")

    # Confidence must be HIGH because fraud_decision == "BLOCK"
    assert result["explanation_confidence"] == "HIGH", (
        f"FAIL: Expected HIGH confidence for BLOCK decision, got {result['explanation_confidence']}"
    )
    print("✓ CONFIDENCE   — 'HIGH' for BLOCK fraud_decision.")

    # Tone must be strict for trust_score < 0.40
    assert result["suggested_tone"] == "strict, firm, and definitive", (
        f"FAIL: Wrong tone: {result['suggested_tone']}"
    )
    print("✓ TONE         — 'strict, firm, and definitive' for trust_score 0.25.")

    # Graph drivers must include cluster_score
    graph_drivers = result["audit_trail_technical"]["graph_drivers"]
    assert any("cluster_score" in d for d in graph_drivers), (
        f"FAIL: cluster_score missing from graph_drivers: {graph_drivers}"
    )
    print("✓ GRAPH AUDIT  — cluster_score present in graph_drivers.")

    # Rule G: engine must not override authoritative decision
    assert result["final_decision"] == "REJECT", (
        "FAIL: Engine overrode the authoritative final_action."
    )
    print("✓ AUTHORITY    — final_decision unchanged from upstream 'REJECT'.")

    print("=" * 72)
    print("All assertions passed.")
    print("=" * 72)