"""
=============================================================
BHIMA ASTRA — Final System Orchestrator  (Phase 3)
File   : orchestrator.py
Role   : Top-level control layer that wires together the Core
         Inference Engine, Policy Engine, and Chatbot into a
         single, API-ready pipeline.
=============================================================
External dependencies (graceful mocks if absent):
  • inference        → run_agentic_orchestration()
  • policy_engine    → PolicyControlEngine
  • bhima_astra      → BhimaChatbot
=============================================================
"""

from __future__ import annotations

import json
import logging
import traceback
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
log = logging.getLogger(__name__)
# --- ADD THIS IN YOUR IMPORTS SECTION ---
try:
    from fusion_engine import ExplanationFusionEngine
    log.info("✅  fusion_engine.ExplanationFusionEngine  loaded.")
except ImportError:
    ExplanationFusionEngine = None
    log.warning("⚠️  fusion_engine not found.")
# ─────────────────────────────────────────────────────────────
# LOGGING SETUP
# ─────────────────────────────────────────────────────────────
logging.basicConfig(
    level   = logging.INFO,
    format  = "%(asctime)s  [%(levelname)s]  %(name)s — %(message)s",
    datefmt = "%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("BhimaOrchestrator")


# =============================================================
# MODULE IMPORTS WITH GRACEFUL MOCK FALLBACKS
# =============================================================

# ── 1. Core Inference Engine ──────────────────────────────────
try:
    from inference import run_agentic_orchestration
    log.info("✅  inference.run_agentic_orchestration  loaded.")
except ImportError:
    log.warning("⚠️  inference not found — using MOCK core engine.")

    def run_agentic_orchestration(features: Dict[str, Any]) -> Dict[str, Any]:  # type: ignore
        """
        MOCK: Simulates the core ML inference + agentic pipeline.
        Returns the same schema as the real module.
        """
        trust   = features.get("trust_score", 0.5)
        manager = features.get("manager_alert", False)

        if trust < 0.3:
            decision, payout, source = "BLOCK",   0.0,   "fraud_engine"
        elif trust < 0.5 and not manager:
            decision, payout, source = "HOLD",  150.0,   "risk_engine"
        elif manager:
            decision, payout, source = "PARTIAL", 320.0, "manager_agent"
        else:
            decision, payout, source = "APPROVE", 480.0, "inference_model"

        tier_multiplier = {"basic": 0.75, "standard": 1.0, "premium": 1.25}.get(
            str(features.get("plan_tier", "standard")).lower(), 1.0
        )

        return {
            "decision":               decision,
            "payout_amount":          round(payout * tier_multiplier, 2),
            "tier_multiplier_applied": tier_multiplier,
            "decision_source":        source,
            "explanation": (
                f"Mock engine: trust={trust:.2f}, manager_alert={manager}, "
                f"tier_multiplier={tier_multiplier}."
            ),
            "agent_logs": [
                f"[fraud_engine]   trust_score={trust:.2f} → {'BLOCK' if trust < 0.3 else 'PASS'}",
                f"[manager_agent]  alert={manager} → disruption={'CONFIRMED' if manager else 'UNVERIFIED'}",
                f"[policy_gate]    payout_pre_policy=₹{payout:.2f}",
            ],
        }


# ── 2. Policy Engine ──────────────────────────────────────────
try:
    from policy_engine import PolicyControlEngine
    log.info("✅  policy_engine.PolicyControlEngine  loaded.")
except ImportError:
    log.warning("⚠️  policy_engine not found — using MOCK PolicyControlEngine.")

    class PolicyControlEngine:  # type: ignore
        """
        MOCK: Simulates the Policy Engine business-rule layer.
        Final authority on payout amount and claim action.
        """

        _WEEKLY_CAPS = {"basic": 600.0, "standard": 800.0, "premium": 1200.0}
        _CLAIM_LIMIT = 2
        _MIN_PAYOUT  = 50.0
        _API_FAIL_CAP = 400.0

        def evaluate(
            self,
            fraud_decision:       str,
            manager_decision:     str,
            predicted_income:     float,
            disruption_prob:      float,
            plan_tier:            str,
            weekly_payout_so_far: float,
            events_this_week:     int,
            trust_score:          float,
            api_status:           Dict[str, bool],
        ) -> Dict[str, Any]:

            audit: List[str] = []
            plan  = plan_tier.lower()

            # ── Fraud gate ─────────────────────────────────────
            if fraud_decision == "BLOCK":
                audit.append("POLICY: fraud_decision=BLOCK → REJECT")
                return self._build(
                    "REJECT", 0.0,
                    "Claim rejected: fraud detected on your account.",
                    audit,
                )

            # ── Weekly claim frequency gate ───────────────────
            if events_this_week >= self._CLAIM_LIMIT:
                audit.append(
                    f"POLICY: events_this_week={events_this_week} "
                    f"≥ limit={self._CLAIM_LIMIT} → REJECT"
                )
                return self._build(
                    "REJECT", 0.0,
                    "Claim rejected: weekly claim limit (2) reached.",
                    audit,
                )

            # ── Compute expected payout ────────────────────────
            severity = (
                1.0  if manager_decision == "CONFIRMED"  else
                0.5  if manager_decision == "PARTIAL"    else
                0.0
            )
            computed = round(disruption_prob * predicted_income * severity, 2)
            audit.append(
                f"POLICY: disruption_prob={disruption_prob}, "
                f"predicted_income={predicted_income}, "
                f"severity={severity} → computed=₹{computed}"
            )

            # ── Unverified disruption ─────────────────────────
            if manager_decision == "UNVERIFIED":
                audit.append("POLICY: manager_decision=UNVERIFIED → REJECT")
                return self._build(
                    "REJECT", 0.0,
                    "Claim rejected: no disruption could be verified.",
                    audit,
                )

            # ── Minimum payout gate ───────────────────────────
            if computed < self._MIN_PAYOUT:
                audit.append(
                    f"POLICY: computed=₹{computed} < min=₹{self._MIN_PAYOUT} → REJECT"
                )
                return self._build(
                    "REJECT", 0.0,
                    f"Claim rejected: computed payout ₹{computed} "
                    f"below minimum ₹{self._MIN_PAYOUT}.",
                    audit,
                )

            # ── API failure cap ───────────────────────────────
            api_ok = all(api_status.values()) if api_status else True
            if not api_ok:
                computed = min(computed, self._API_FAIL_CAP)
                audit.append(
                    f"POLICY: API failure detected → cap applied, "
                    f"payout=₹{computed}"
                )

            # ── Weekly payout cap ─────────────────────────────
            weekly_cap  = self._WEEKLY_CAPS.get(plan, 800.0)
            remaining   = max(0.0, weekly_cap - weekly_payout_so_far)
            final_payout = min(computed, remaining)
            audit.append(
                f"POLICY: weekly_cap=₹{weekly_cap}, "
                f"already_paid=₹{weekly_payout_so_far}, "
                f"remaining=₹{remaining} → final=₹{final_payout}"
            )

            if final_payout <= 0:
                audit.append("POLICY: no remaining weekly budget → REJECT")
                return self._build(
                    "REJECT", 0.0,
                    "Claim rejected: weekly payout limit reached for your plan.",
                    audit,
                )

            # ── Suspicious / HOLD ─────────────────────────────
            if fraud_decision == "REVIEW" or trust_score < 0.35:
                audit.append(
                    "POLICY: fraud=REVIEW or low trust_score → HOLD"
                )
                return self._build(
                    "HOLD", final_payout,
                    "Your claim is under review. We will update you within 24 hours.",
                    audit,
                )

            # ── Approved ──────────────────────────────────────
            audit.append(f"POLICY: all checks passed → PAY ₹{final_payout}")
            return self._build(
                "PAY", final_payout,
                f"Your claim is approved! ₹{final_payout:.2f} will be credited shortly.",
                audit,
            )

        @staticmethod
        def _build(
            action:  str,
            payout:  float,
            message: str,
            audit:   List[str],
        ) -> Dict[str, Any]:
            return {
                "final_action":        action,
                "final_payout_amount": round(payout, 2),
                "user_message":        message,
                "audit_trail":         audit,
            }


# ── 3. Chatbot ────────────────────────────────────────────────
try:
    from bhima_astra import BhimaChatbot
    log.info("✅  bhima_astra.BhimaChatbot  loaded.")
except ImportError:
    log.warning("⚠️  bhima_astra not found — using MOCK BhimaChatbot.")

    class BhimaChatbot:  # type: ignore
        """MOCK: Generates a plain-text claim explanation."""

        def chatbot(
            self,
            query:        str,
            final_result: Optional[Dict[str, Any]] = None,
        ) -> str:
            if final_result is None:
                return "No claim result available to explain."

            action  = final_result.get("final_action",        "UNKNOWN")
            payout  = final_result.get("final_payout_amount",  0.0)
            fraud   = final_result.get("fraud_decision",       "UNKNOWN")
            manager = final_result.get("manager_decision",     "UNKNOWN")
            risk    = final_result.get("risk_index",            0.0)
            logs    = final_result.get("audit_log",             [])

            icon = {"PAY": "✅", "HOLD": "⏳", "REJECT": "❌"}.get(action, "ℹ️")
            lines = [
                "=" * 55,
                "  BHIMA ASTRA — CLAIM EXPLANATION",
                "=" * 55,
                f"  {icon}  Decision     : {action}",
                f"  💰  Payout       : ₹{payout:.2f}",
                f"  🔍  Fraud Check  : {fraud}",
                f"  📡  Disruption   : {manager}",
                f"  📊  Risk Index   : {int(risk * 100)}%",
                "",
                "  Audit Trail:",
            ]
            for i, entry in enumerate(logs, 1):
                lines.append(f"    {i}. {entry}")
            lines.append("=" * 55)
            return "\n".join(lines)


# =============================================================
# CONSTANTS & DEFAULTS
# =============================================================

REQUIRED_KEYS: List[str] = [
    "features", "city", "worker_id", "zone_id",
    "manager_alert", "plan_tier", "weekly_payout_so_far",
    "events_this_week", "trust_score", "api_status", "language",
]

KEY_DEFAULTS: Dict[str, Any] = {
    "features":            {},
    "city":                "unknown",
    "worker_id":           0,
    "zone_id":             "Z000",
    "manager_alert":       False,
    "plan_tier":           "standard",
    "weekly_payout_so_far": 0.0,
    "events_this_week":    0,
    "trust_score":         0.5,
    "api_status":          {"weather": True, "traffic": True, "maps": True},
    "language":            "en",
}

SAFE_FALLBACK_RESPONSE: Dict[str, Any] = {
    "final_action":         "HOLD",
    "final_payout_amount":  0.0,
    "decision_source":      "orchestrator_safety_fallback",
    "core_engine_output":   {},
    "policy_output":        {},
    "chatbot_explanation":  (
        "A critical system error occurred. Your claim has been "
        "placed on HOLD. Please contact support@bhimaastra.ai."
    ),
    "system_logs":          ["CRITICAL: orchestrator entered global exception boundary."],
}


# =============================================================
# ORCHESTRATOR CLASS
# =============================================================

class BhimaOrchestrator:
    """
    Top-level control layer for BHIMA ASTRA.

    Responsibilities
    ────────────────
    1. Validate & normalise the incoming claim request.
    2. Route to the Core Inference Engine.
    3. Apply the Policy Engine (final authority on action + payout).
    4. Attach a human-readable Chatbot explanation.
    5. Return a fully structured, JSON-serialisable response.
    """

    def __init__(self) -> None:
        self._policy  = PolicyControlEngine()
        self._chatbot = BhimaChatbot()
        self._fusion  = ExplanationFusionEngine() if ExplanationFusionEngine else None # 🔥 NEW
        log.info("BhimaOrchestrator ready.")

    # ─────────────────────────────────────────────────────────
    # PRIVATE: INPUT VALIDATION
    # ─────────────────────────────────────────────────────────
    def _validate_request(
        self,
        claim_request: Dict[str, Any],
        system_logs:   List[str],
    ) -> Dict[str, Any]:
        """
        Checks for missing keys and injects safe defaults.
        Mutates system_logs in-place for audit trail continuity.
        Returns a normalised copy of the request.
        """
        normalised = dict(claim_request)   # shallow copy; we own this dict

        for key in REQUIRED_KEYS:
            if key not in normalised or normalised[key] is None:
                default = KEY_DEFAULTS[key]
                normalised[key] = default
                msg = (
                    f"VALIDATION: missing key '{key}' — "
                    f"defaulted to {repr(default)}"
                )
                system_logs.append(msg)
                log.warning(msg)
            else:
                system_logs.append(f"VALIDATION: '{key}' ✓")

        # ── Type-coerce critical numeric fields ───────────────
        for field, cast in (
            ("weekly_payout_so_far", float),
            ("events_this_week",     int),
            ("trust_score",          float),
            ("worker_id",            int),
        ):
            try:
                normalised[field] = cast(normalised[field])
            except (TypeError, ValueError):
                normalised[field] = KEY_DEFAULTS[field]
                system_logs.append(
                    f"VALIDATION: '{field}' could not be cast to "
                    f"{cast.__name__} — reset to default."
                )

        # ── Clamp trust_score to [0.0, 1.0] ──────────────────
        normalised["trust_score"] = max(0.0, min(1.0, normalised["trust_score"]))

        system_logs.append("VALIDATION: request normalisation complete.")
        return normalised

    # ─────────────────────────────────────────────────────────
    # PUBLIC: MAIN PIPELINE
    # ─────────────────────────────────────────────────────────
    def process_claim(
        self,
        claim_request: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Executes the full BHIMA ASTRA orchestration pipeline.

        Pipeline
        ────────
        Step 1  → Validate & normalise input
        Step 2  → Global exception boundary (safe HOLD fallback)
        Step 3  → Core Inference Engine
        Step 4  → Extract signals for Policy Engine
        Step 5  → Policy Engine (final authority)
        Step 6  → Build final_result + Chatbot explanation
        Step 7  → Merge and return structured response
        """
        system_logs: List[str] = []
        request_id  = str(uuid.uuid4())[:8].upper()
        ts_start    = datetime.now(tz=timezone.utc).isoformat()

        system_logs.append(f"ORCHESTRATOR: request_id={request_id}  ts={ts_start}")
        log.info("process_claim() started  [request_id=%s]", request_id)

        # ── Step 1: Validate & normalise ─────────────────────
        try:
            req = self._validate_request(claim_request, system_logs)
        except Exception:
            system_logs.append(
                "CRITICAL: _validate_request() raised an exception — "
                "falling back to safe HOLD state."
            )
            log.exception("Validation layer crashed.")
            return {**SAFE_FALLBACK_RESPONSE, "system_logs": system_logs}

        # ── Step 2: Global Exception Boundary ─────────────────
        try:

            # ── Step 3: Core Inference Engine ─────────────────
            system_logs.append("CORE_ENGINE: invoking run_agentic_orchestration()")
            log.info("[%s] Calling core inference engine …", request_id)

            # Merge request-level signals into the features dict so the
            # core engine has full context without us re-implementing logic.
            enriched_features: Dict[str, Any] = {
                **req.get("features", {}),
                "city":                req["city"],
                "worker_id":           req["worker_id"],
                "zone_id":             req["zone_id"],
                "manager_alert":       req["manager_alert"],
                "plan_tier":           req["plan_tier"],
                "weekly_payout_so_far": req["weekly_payout_so_far"],
                "events_this_week":    req["events_this_week"],
                "trust_score":         req["trust_score"],
                "api_status":          req["api_status"],
            }

            core_output: Dict[str, Any] = run_agentic_orchestration(
            features=enriched_features,
            city=req.get("city", "Vijayawada"),           # Passes city for severity multiplier
            worker_id=req.get("worker_id", 0),            # Passes worker ID for fraud graph
            zone_id=req.get("zone_id", "UNKNOWN"),        # Passes zone ID
            manager_alert=req.get("manager_alert", False) # Passes manager flag
        )
            system_logs.append(
                f"CORE_ENGINE: decision={core_output.get('decision')}  "
                f"payout=₹{core_output.get('payout_amount', 0):.2f}  "
                f"source={core_output.get('decision_source')}"
            )
            system_logs.extend(core_output.get("agent_logs", []))
            log.info(
                "[%s] Core engine → decision=%s  payout=₹%.2f",
                request_id,
                core_output.get("decision"),
                core_output.get("payout_amount", 0),
            )

            # ── Step 4: Extract signals for Policy Engine ──────
            #
            # predicted_income: prefer explicit feature, else fall back to
            #   the core engine's payout (pre-policy) as a proxy.
            predicted_income: float = float(
                req.get("features", {}).get("predicted_income")
                or core_output.get("payout_amount", 0)
                or 500.0                                   # hard fallback
            )

            # disruption_prob: prefer feature flag, else derive from decision.
            _prob_map = {"APPROVE": 0.85, "PARTIAL": 0.55, "HOLD": 0.30, "BLOCK": 0.0}
            disruption_prob: float = float(
                req.get("features", {}).get("disruption_prob")
                or _prob_map.get(core_output.get("decision", "HOLD"), 0.3)
            )

            # fraud_decision mirrors the core engine's raw decision gate.
            fraud_decision: str = "BLOCK" if core_output.get("decision") == "BLOCK" else "APPROVE"

            # manager_decision is derived from manager_alert + core decision.
            if fraud_decision == "APPROVE" and req["manager_alert"]:
                manager_decision = "CONFIRMED"
            elif fraud_decision == "PARTIAL":
                manager_decision = "PARTIAL"
            elif fraud_decision == "BLOCK":
                manager_decision = "UNVERIFIED"
            else:
                manager_decision = "CONFIRMED" if req["manager_alert"] else "UNVERIFIED"

            system_logs.append(
                f"SIGNAL_EXTRACTION: predicted_income=₹{predicted_income:.2f}  "
                f"disruption_prob={disruption_prob:.2f}  "
                f"fraud_decision={fraud_decision}  "
                f"manager_decision={manager_decision}"
            )

            # ── Step 5: Policy Engine (FINAL authority) ────────
            system_logs.append("POLICY_ENGINE: invoking PolicyControlEngine.evaluate()")
            log.info("[%s] Calling Policy Engine …", request_id)

            # Package all inputs into a single dictionary for the v2 Policy Engine
            policy_inputs = {
                "claim_id":             request_id,
                "fraud_decision":       fraud_decision,
                "risk_index":           round(1.0 - req["trust_score"], 2),
                "trigger_flag":         manager_decision in ["CONFIRMED", "PARTIAL"],
                "trigger_severity_multiplier": 1.0 if manager_decision == "CONFIRMED" else (0.5 if manager_decision == "PARTIAL" else 0.0),
                "predicted_income":     predicted_income,
                "disruption_prob":      disruption_prob,
                "plan_tier":            req["plan_tier"],
                "weekly_payout_so_far": req["weekly_payout_so_far"],
                "events_this_week":     req["events_this_week"],
                "trust_score":          req["trust_score"],
                "api_status":           req["api_status"],
                "claims_last_24h":      0  # Default for temporal check
            }

            policy_output: Dict[str, Any] = self._policy.evaluate(policy_inputs)
            system_logs.append(
                f"POLICY_ENGINE: final_action={policy_output.get('final_action')}  "
                f"final_payout=₹{policy_output.get('final_payout_amount', 0):.2f}"
            )
            system_logs.extend(policy_output.get("audit_trail", []))
            log.info(
                "[%s] Policy Engine → final_action=%s  final_payout=₹%.2f",
                request_id,
                policy_output.get("final_action"),
                policy_output.get("final_payout_amount", 0),
            )

            # ── Step 6: Build final_result + Fusion Engine + Chatbot ──────────
            
            # 🔥 FIX 3: Extract graph signals strictly
            graph_signals = []
            if core_output.get("cluster_score", 0) > 0.7:
                graph_signals.append("cluster_score")
            if core_output.get("network_risk_flag") == 1:
                graph_signals.append("network_risk_flag")

            # 🔥 NEW: Prepare inputs for the Fusion Engine
            fusion_inputs = {
                "final_action":   policy_output.get("final_action", "HOLD"),
                "fraud_decision": fraud_decision,
                "payout_amount":  policy_output.get("final_payout_amount", 0.0),
                "trust_score":    req.get("trust_score", 0.5),
                "cluster_score":  core_output.get("cluster_score", 0.0),
                "cluster_size":   core_output.get("cluster_size", 1),
                "risk_index":     round(1.0 - req.get("trust_score", 0.5), 2),
                "policy_reason":  " | ".join(policy_output.get("audit_trail", [])), # 🔥 FIX 2: Correct policy field
                "rule_flags":     core_output.get("stage1_rule_flags", []),
                "graph_signals":  graph_signals,
                "shap_explanation": core_output.get("shap_explanation", [])
            }

            # Generate the Fused Audit Object Safely
            fused_audit = {}
            if self._fusion:
                try:
                    # 🔥 FIX 6: Fusion engine should not break pipeline
                    fused_audit = self._fusion.build_audit_object(fusion_inputs)
                    system_logs.append(f"FUSION_ENGINE: Generated audit with confidence {fused_audit.get('explanation_confidence')}")
                except Exception as e:
                    fused_audit = {}
                    system_logs.append(f"FUSION_ENGINE_ERROR: {e}")

            # Chatbot query (pass language down safely)
            chatbot_query = f"Explain this claim decision in {req['language']}"
            system_logs.append(f"CHATBOT: generating explanation [lang={req['language']}]")
            
            chatbot_explanation: str = self._chatbot.chatbot(
                query        = chatbot_query,
                final_result = fused_audit, # Passing the FUSED object now
            )

            # ── Step 7: Merge and return ───────────────────────
            ts_end = datetime.now(tz=timezone.utc).isoformat()
            system_logs.append(
                f"ORCHESTRATOR: pipeline complete  ts={ts_end}  "
                f"request_id={request_id}"
            )
            log.info(
                "[%s] Orchestration complete → %s ₹%.2f",
                request_id,
                policy_output["final_action"],
                policy_output["final_payout_amount"],
            )

            return {
                "request_id":           request_id,
                "final_action":         policy_output["final_action"],
                "final_payout_amount":  policy_output["final_payout_amount"],
                "decision_source":      "Policy Engine" if policy_output["final_action"] != core_output.get("decision") else core_output.get("decision_source", "unknown"),
                "core_engine_output":   core_output,
                "policy_output":        policy_output,
                "fused_audit":          fused_audit, # 🔥 ADDED
                "chatbot_explanation":  chatbot_explanation,
                "system_logs":          system_logs,
            }

        # ── Step 2 (cont.): Global exception handler ──────────
        except Exception:
            tb = traceback.format_exc()
            system_logs.append(f"CRITICAL EXCEPTION:\n{tb}")
            log.exception(
                "[%s] Unhandled exception in orchestration pipeline.", request_id
            )
            fallback = dict(SAFE_FALLBACK_RESPONSE)
            fallback["request_id"]  = request_id
            fallback["system_logs"] = system_logs
            return fallback


# =============================================================
# TEST BLOCK
# =============================================================

if __name__ == "__main__":

    print("\n" + "=" * 65)
    print("  BHIMA ASTRA — ORCHESTRATOR DEMO")
    print("=" * 65 + "\n")

    # ── Rich, realistic sample claim request ─────────────────
    sample_claim_request: Dict[str, Any] = {
        "features": {
            "gps_mismatch_score":   0.12,
            "speed_anomaly_flag":   False,
            "rainfall_intensity":   74.5,      # mm/hr
            "route_feasibility":    0.38,      # 0 = no route, 1 = clear
            "rider_velocity_kmh":   1.4,
            "crowd_signal_score":   0.81,
            "predicted_income":     620.0,     # ₹ estimated for disruption window
            "disruption_prob":      0.78,
        },
        "city":                  "Hyderabad",
        "worker_id":             10472,
        "zone_id":               "HYD-NW-07",
        "manager_alert":         True,
        "plan_tier":             "standard",
        "weekly_payout_so_far":  150.0,        # ₹ already paid this week
        "events_this_week":      1,            # 1 previous claim this week
        "trust_score":           0.74,         # High trust
        "api_status": {
            "weather": True,
            "traffic": True,
            "maps":    True,
        },
        "language":              "te",         # Telugu
    }

    # ── Initialise and run ────────────────────────────────────
    orchestrator = BhimaOrchestrator()

    print("📥  Claim Request:")
    print(json.dumps(sample_claim_request, indent=2, default=str))
    print("\n" + "─" * 65 + "\n")

    result = orchestrator.process_claim(sample_claim_request)

    # ── Pretty-print full structured output ──────────────────
    print("📤  Orchestrator Response:")
    print(json.dumps(result, indent=2, default=str))

    # ── Chatbot explanation rendered separately ───────────────
    print("\n" + "─" * 65)
    print("💬  Chatbot Explanation (rendered):")
    print(result.get("chatbot_explanation", "N/A"))

    # ─────────────────────────────────────────────────────────
    # EDGE CASE 1 — Low trust score (HOLD path)
    # ─────────────────────────────────────────────────────────
    print("\n" + "=" * 65)
    print("  EDGE CASE 1 — Low Trust Score (expected: HOLD)")
    print("=" * 65)
    low_trust_request = dict(sample_claim_request)
    low_trust_request["trust_score"]   = 0.28
    low_trust_request["worker_id"]     = 20011
    low_trust_request["events_this_week"] = 1
    low_trust_result = orchestrator.process_claim(low_trust_request)
    print(json.dumps({
        "request_id":          low_trust_result.get("request_id"),
        "final_action":        low_trust_result.get("final_action"),
        "final_payout_amount": low_trust_result.get("final_payout_amount"),
        "policy_user_message": low_trust_result["policy_output"].get("user_message"),
    }, indent=2))

    # ─────────────────────────────────────────────────────────
    # EDGE CASE 2 — Weekly limit exceeded (REJECT path)
    # ─────────────────────────────────────────────────────────
    print("\n" + "=" * 65)
    print("  EDGE CASE 2 — Weekly Claim Limit Exceeded (expected: REJECT)")
    print("=" * 65)
    limit_request = dict(sample_claim_request)
    limit_request["events_this_week"] = 2      # already at max
    limit_request["worker_id"]        = 30099
    limit_result = orchestrator.process_claim(limit_request)
    print(json.dumps({
        "request_id":          limit_result.get("request_id"),
        "final_action":        limit_result.get("final_action"),
        "final_payout_amount": limit_result.get("final_payout_amount"),
        "policy_user_message": limit_result["policy_output"].get("user_message"),
    }, indent=2))

    # ─────────────────────────────────────────────────────────
    # EDGE CASE 3 — Missing keys (validation fallback path)
    # ─────────────────────────────────────────────────────────
    print("\n" + "=" * 65)
    print("  EDGE CASE 3 — Incomplete Input (validation defaults)")
    print("=" * 65)
    incomplete_request: Dict[str, Any] = {
        "worker_id": 40001,
        "city":      "Vijayawada",
        # all other keys intentionally missing
    }
    incomplete_result = orchestrator.process_claim(incomplete_request)
    print(json.dumps({
        "request_id":          incomplete_result.get("request_id"),
        "final_action":        incomplete_result.get("final_action"),
        "final_payout_amount": incomplete_result.get("final_payout_amount"),
        "validation_logs": [
            l for l in incomplete_result.get("system_logs", [])
            if "VALIDATION" in l
        ],
    }, indent=2))

    print("\n" + "=" * 65)
    print("  ✅  All demo scenarios complete.")
    print("=" * 65 + "\n")