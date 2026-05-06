"""
BHIMA ASTRA — Manager Intelligence Agent
=========================================
Final integration layer for real-world disruption verification.

Author  : BHIMA ASTRA Backend Team
Version : 1.0.0
Module  : manager_agent.py
"""

from __future__ import annotations

import asyncio
import logging
import math
import random
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any



# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
logger = logging.getLogger("bhima.manager_agent")


# ---------------------------------------------------------------------------
# Enumerations & Constants
# ---------------------------------------------------------------------------


class RouteStatus(str, Enum):
    CLEAR = "CLEAR"
    DETOUR = "DETOUR"
    BLOCKED = "BLOCKED"


class VerifiedStatus(str, Enum):
    CONFIRMED = "CONFIRMED"
    PARTIAL = "PARTIAL"
    UNVERIFIED = "UNVERIFIED"


class DecisionSource(str, Enum):
    ROUTE_CROWD_MANAGER = "ROUTE + CROWD + MANAGER"
    CROWD_MANAGER = "CROWD + MANAGER"
    HISTORICAL_CROWD_MANAGER = "HISTORICAL + CROWD + MANAGER"
    MANAGER_ONLY = "MANAGER"


# Haversine earth radius (km)
_EARTH_RADIUS_KM: float = 6371.0

# Base detour threshold in km before multipliers are applied
_BASE_DETOUR_THRESHOLD_KM: float = 2.5

# Simulated historical disruption likelihoods per city zone type
_HISTORICAL_DISRUPTION_LIKELIHOOD: dict[str, float] = {
    "high_density": 0.72,
    "medium_density": 0.45,
    "low_density": 0.22,
    "default": 0.40,
}


# ---------------------------------------------------------------------------
# Data Structures
# ---------------------------------------------------------------------------


@dataclass
class Coordinates:
    """Latitude / longitude pair."""

    lat: float
    lon: float

    def __post_init__(self) -> None:
        if not (-90 <= self.lat <= 90):
            raise ValueError(f"Invalid latitude: {self.lat}")
        if not (-180 <= self.lon <= 180):
            raise ValueError(f"Invalid longitude: {self.lon}")


@dataclass
class RouteAPIResponse:
    route_distance: float          # km
    detour_distance: float         # km
    route_status: RouteStatus
    api_success: bool = True
    error_message: str = ""


@dataclass
class CrowdSignals:
    avg_rider_velocity: float      # km/h
    rider_density: float           # riders per sq-km (normalised 0–1 OK too)
    crowd_duration_minutes: float  # how long crowd blockage has persisted


@dataclass
class ZoneContext:
    city_multiplier: float = 1.0   # e.g. 1.3 for Mumbai, 0.9 for Tier-3
    zone_risk_score: float = 1.0   # 0.5–2.0 based on historical incidents
    zone_type: str = "default"     # "high_density" | "medium_density" etc.


@dataclass
class ManagerAlert:
    manager_id: str
    manager_alert_flag: bool
    manager_trust_score: float     # 0.0 – 1.0
    alerts_last_hour: int = 0      # 🔥 NEW: Abuse protection

@dataclass
class VerificationResult:
    verified_status: VerifiedStatus
    confidence_score: float
    decision_source: DecisionSource
    detour_distance: float
    adaptive_threshold: float
    payout_multiplier: float       # 🔥 FIX 5: Link to Policy Engine
    audit_log: list[dict[str, Any]]
    timestamp: str
    manager_id: str


# ---------------------------------------------------------------------------
# Utility helpers
# ---------------------------------------------------------------------------


def _haversine_km(a: Coordinates, b: Coordinates) -> float:
    """Straight-line great-circle distance between two coordinates (km)."""
    lat1, lon1 = math.radians(a.lat), math.radians(a.lon)
    lat2, lon2 = math.radians(b.lat), math.radians(b.lon)
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    h = (
        math.sin(dlat / 2) ** 2
        + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    )
    return 2 * _EARTH_RADIUS_KM * math.asin(math.sqrt(h))


def _percentile_rank(value: float, population: list[float]) -> float:
    """
    Return the percentile rank (0–100) of *value* within *population*.
    Uses linear interpolation; falls back to 50 if population is empty.
    """
    if not population:
        return 50.0
    below = sum(1 for v in population if v < value)
    equal = sum(1 for v in population if v == value)
    n = len(population)
    return 100.0 * (below + 0.5 * equal) / n


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# Simulated historical population data
# (In production, replace with a Redis/PostgreSQL time-series query.)
# ---------------------------------------------------------------------------


def _simulated_detour_population(zone_type: str) -> list[float]:
    """Return a plausible historical sample of detour distances for a zone."""
    rng = random.Random(hash(zone_type) & 0xFFFF)
    base = {"high_density": 3.5, "medium_density": 2.2, "low_density": 1.2}.get(
        zone_type, 2.0
    )
    return [abs(rng.gauss(base, 0.8)) for _ in range(200)]


def _simulated_velocity_population(zone_type: str) -> list[float]:
    """Return a plausible historical sample of rider velocities for a zone."""
    rng = random.Random(hash(zone_type + "_vel") & 0xFFFF)
    base = {"high_density": 14.0, "medium_density": 18.0, "low_density": 22.0}.get(
        zone_type, 17.0
    )
    return [max(1.0, rng.gauss(base, 4.0)) for _ in range(200)]


# ---------------------------------------------------------------------------
# Core Agent
# ---------------------------------------------------------------------------


class ManagerIntelligenceAgent:
    """
    BHIMA ASTRA — Manager Intelligence Agent
    -----------------------------------------
    Verifies real-world disruptions by fusing:
      • Route feasibility (OSRM / Google Maps simulation)
      • Crowd signal analysis
      • Manager alert trust scoring
      • Adaptive thresholding
      • Audit-logged arbitration
    """

    # ------------------------------------------------------------------
    # Construction
    # ------------------------------------------------------------------

    def __init__(
        self,
        route_api_url: str = "https://router.project-osrm.org/route/v1/driving/",
        api_timeout_seconds: float = 5.0,
        base_detour_threshold_km: float = _BASE_DETOUR_THRESHOLD_KM,
    ) -> None:
        self._route_api_url = route_api_url
        self._api_timeout = api_timeout_seconds
        self._base_threshold = base_detour_threshold_km
        logger.info(
            "ManagerIntelligenceAgent initialised "
            "(base_threshold=%.2f km, timeout=%.1fs)",
            self._base_threshold,
            self._api_timeout,
        )

    # ------------------------------------------------------------------
    # PUBLIC — Main Entry Point
    # ------------------------------------------------------------------

    async def verify_disruption(
        self,
        *,
        delivery_zone_coords: Coordinates,
        dark_store_coords: Coordinates,
        crowd_signals: CrowdSignals,
        zone_context: ZoneContext,
        manager_alert: ManagerAlert,
    ) -> VerificationResult:
        """
        Full disruption-verification pipeline.

        Returns a :class:`VerificationResult` with status, confidence,
        decision source, distances, thresholds, and a complete audit log.
        """
        audit: list[dict[str, Any]] = []
        request_id = str(uuid.uuid4())

        audit.append(
            {
                "step": "REQUEST_RECEIVED",
                "request_id": request_id,
                "manager_id": manager_alert.manager_id,
                "manager_alert_flag": manager_alert.manager_alert_flag,
                "manager_trust_score": manager_alert.manager_trust_score,
                "timestamp": _now_iso(),
            }
        )

        # ── 1. Route Feasibility ────────────────────────────────────────
        route_response = await self._fetch_route_feasibility(
            delivery_zone_coords, 
            dark_store_coords,
            zone_context.zone_type,                 # 🔥 FIX 1: Pass context
            crowd_signals.avg_rider_velocity        # 🔥 FIX 1: Pass velocity
        )
        audit.append(
            {
                "step": "ROUTE_FEASIBILITY",
                "api_success": route_response.api_success,
                "route_distance_km": route_response.route_distance,
                "detour_distance_km": route_response.detour_distance,
                "route_status": route_response.route_status,
                "error": route_response.error_message or None,
                "timestamp": _now_iso(),
            }
        )

        # ── 2. Adaptive Threshold ───────────────────────────────────────
        adaptive_threshold = self._compute_adaptive_threshold(zone_context)
        audit.append(
            {
                "step": "ADAPTIVE_THRESHOLD",
                "base_threshold_km": self._base_threshold,
                "city_multiplier": zone_context.city_multiplier,
                "zone_risk_score": zone_context.zone_risk_score,
                "adaptive_threshold_km": adaptive_threshold,
                "timestamp": _now_iso(),
            }
        )

        # ── 3. Percentile Metrics ───────────────────────────────────────
        detour_pct, velocity_pct = self._compute_percentiles(
            route_response.detour_distance,
            crowd_signals.avg_rider_velocity,
            zone_context.zone_type,
        )
        audit.append(
            {
                "step": "PERCENTILE_METRICS",
                "detour_percentile": detour_pct,
                "velocity_percentile": velocity_pct,
                "timestamp": _now_iso(),
            }
        )

        # ── 4. Crowd Blockage Score ─────────────────────────────────────
        crowd_score = self._compute_crowd_blockage_score(crowd_signals)
        dynamic_duration_threshold = self._dynamic_duration_threshold(
            zone_context, crowd_signals
        )
        audit.append(
            {
                "step": "CROWD_SIGNAL",
                "avg_rider_velocity_kmh": crowd_signals.avg_rider_velocity,
                "rider_density": crowd_signals.rider_density,
                "crowd_duration_minutes": crowd_signals.crowd_duration_minutes,
                "crowd_blockage_score": crowd_score,
                "dynamic_duration_threshold_min": dynamic_duration_threshold,
                "timestamp": _now_iso(),
            }
        )

        # ── 5. Arbitration ──────────────────────────────────────────────
        (
            verified_status,
            confidence_score,
            decision_source,
        ) = self._arbitrate(
            manager_alert=manager_alert,
            route_response=route_response,
            adaptive_threshold=adaptive_threshold,
            detour_percentile=detour_pct,
            velocity_percentile=velocity_pct,
            crowd_signals=crowd_signals,
            dynamic_duration_threshold=dynamic_duration_threshold,
            crowd_score=crowd_score,
            zone_context=zone_context,
        )

        # ── 6. Trust Adjustment ─────────────────────────────────────────
        confidence_score = self._apply_trust_adjustment(
            confidence_score, manager_alert.manager_trust_score
        )
        audit.append(
            {
                "step": "TRUST_ADJUSTMENT",
                "trust_score": manager_alert.manager_trust_score,
                "adjusted_confidence": confidence_score,
                "timestamp": _now_iso(),
            }
        )
        if verified_status == VerifiedStatus.CONFIRMED:
            payout_multiplier = 1.0
        elif verified_status == VerifiedStatus.UNVERIFIED:
            payout_multiplier = 0.0
        else: # PARTIAL
            detour_ratio = route_response.detour_distance / (adaptive_threshold + 1e-9)
            payout_multiplier = round(0.3 + (min(1.0, detour_ratio) * 0.4), 2)
        audit.append(
            {
                "step": "FINAL_DECISION",
                "verified_status": verified_status,
                "confidence_score": confidence_score,
                "decision_source": decision_source,
                "payout_multiplier": payout_multiplier, # 🔥 Added payout info to audit log
                "timestamp": _now_iso(),
            }
        )

        logger.info(
            "[%s] manager=%s status=%s confidence=%.2f source=%s | payout_mult=%.2f",
            request_id,
            manager_alert.manager_id,
            verified_status,
            confidence_score,
            decision_source,
            payout_multiplier
        )

        return VerificationResult(
            verified_status=verified_status,
            confidence_score=round(confidence_score, 4),
            decision_source=decision_source,
            detour_distance=round(route_response.detour_distance, 3),
            adaptive_threshold=round(adaptive_threshold, 3),
            payout_multiplier=payout_multiplier, # 🔥 Using Dynamic Payout
            audit_log=audit,
            timestamp=_now_iso(),
            manager_id=manager_alert.manager_id,
        )

    # ------------------------------------------------------------------
    # 1 — Route Feasibility (Simulated OSRM / Google Maps Layer)
    # ------------------------------------------------------------------

    async def _fetch_route_feasibility(
        self,
        origin: Coordinates,
        destination: Coordinates,
        zone_type: str,         # 🔥 FIX 1
        avg_velocity: float,    # 🔥 FIX 1
    ) -> RouteAPIResponse:
        """
        Query the routing API with timeout handling.

        On failure (timeout, network error, bad response) the method falls
        back to a haversine straight-line estimate and marks api_success=False.
        """
        try:
            route_response = await asyncio.wait_for(
                self._call_route_api(origin, destination , zone_type, avg_velocity),
                timeout=self._api_timeout,
            )
            return route_response

        except asyncio.TimeoutError:
            logger.warning("Route API timed out — using haversine fallback.")
            return self._haversine_fallback(origin, destination, "API_TIMEOUT")

        except Exception as exc:  # noqa: BLE001
            logger.warning("Route API error (%s) — using haversine fallback.", exc)
            return self._haversine_fallback(origin, destination, str(exc))

    async def _call_route_api(
        self,
        origin: Coordinates,
        destination: Coordinates,
        zone_type: str,         # 🔥 FIX 1
        avg_velocity: float,
    ) -> RouteAPIResponse:
        """
        Simulated OSRM call.

        In production replace the body with a real httpx call:

            url = (
                f"{self._route_api_url}"
                f"{origin.lon},{origin.lat};"
                f"{destination.lon},{destination.lat}"
                "?overview=false"
            )
            async with httpx.AsyncClient() as client:
                resp = await client.get(url, timeout=self._api_timeout)
                data = resp.json()
                ...parse OSRM response...

        For now we simulate realistic values from haversine + noise.
        """
        await asyncio.sleep(0.05)  # simulate network latency

        straight_line = _haversine_km(origin, destination)

        seed = hash((
                origin.lat, origin.lon, 
                destination.lat, destination.lon,
                zone_type,
                int(avg_velocity)
            )) & 0xFFFF
        rng = random.Random(seed)
        # Simulate road-network overhead (roads are ~1.2–1.5× straight line)
        route_distance = straight_line * rng.uniform(1.2, 1.5)

        # Simulate detour: 0 if clear, small if detour, large if blocked
        scenario = rng.choices(
            ["CLEAR", "DETOUR", "BLOCKED"], weights=[0.55, 0.30, 0.15]
        )[0]

        if scenario == "CLEAR":
            detour_distance = 0.0
            status = RouteStatus.CLEAR
        elif scenario == "DETOUR":
            detour_distance = route_distance * rng.uniform(0.2, 0.6)
            status = RouteStatus.DETOUR
        else:
            detour_distance = route_distance * rng.uniform(0.7, 1.5)
            status = RouteStatus.BLOCKED

        return RouteAPIResponse(
            route_distance=round(route_distance, 3),
            detour_distance=round(detour_distance, 3),
            route_status=status,
            api_success=True,
        )

    def _haversine_fallback(
        self,
        origin: Coordinates,
        destination: Coordinates,
        reason: str,
    ) -> RouteAPIResponse:
        """Fallback when the route API is unavailable."""
        straight_line = _haversine_km(origin, destination)
        estimated_route = straight_line * 1.35  # median road multiplier
        return RouteAPIResponse(
            route_distance=round(estimated_route, 3),
            detour_distance=0.0,           # unknown — conservative
            route_status=RouteStatus.CLEAR,  # optimistic until crowd says otherwise
            api_success=False,
            error_message=reason,
        )

    # ------------------------------------------------------------------
    # 2 — Adaptive Thresholding
    # ------------------------------------------------------------------

    def _compute_adaptive_threshold(self, zone: ZoneContext) -> float:
        """
        adaptive_detour_threshold =
            base_threshold × city_multiplier × zone_risk_score
        """
        threshold = (
            self._base_threshold
            * zone.city_multiplier
            * zone.zone_risk_score
        )
        return max(0.5, round(threshold, 3))  # floor at 500 m

    # ------------------------------------------------------------------
    # 3 — Percentile Metrics
    # ------------------------------------------------------------------

    def _compute_percentiles(
        self,
        detour_distance: float,
        avg_rider_velocity: float,
        zone_type: str,
    ) -> tuple[float, float]:
        """
        Return (detour_percentile, velocity_percentile) for the current
        observation relative to the historical population for this zone.
        """
        detour_pop = _simulated_detour_population(zone_type)
        velocity_pop = _simulated_velocity_population(zone_type)

        detour_pct = _percentile_rank(detour_distance, detour_pop)
        velocity_pct = _percentile_rank(avg_rider_velocity, velocity_pop)

        return round(detour_pct, 2), round(velocity_pct, 2)

    # ------------------------------------------------------------------
    # 4 — Crowd Blockage Score
    # ------------------------------------------------------------------

    @staticmethod
    def _compute_crowd_blockage_score(signals: CrowdSignals) -> float:
        """
        crowd_blockage_score ∈ [0, 1]

        Combines:
          • inverse velocity (slow riders → high blockage)
          • rider density   (more riders → more blockage)
          • duration        (longer event → higher confidence)

        Formula (empirically tuned):
          velocity_factor = clamp(1 − v/50, 0, 1)
          density_factor  = clamp(density/10, 0, 1)   (normalises 0–10 scale)
          duration_factor = clamp(duration/120, 0, 1)  (saturates at 2 h)

          score = 0.45·velocity + 0.35·density + 0.20·duration
        """
        velocity_factor = max(0.0, min(1.0, 1.0 - signals.avg_rider_velocity / 50.0))
        density_factor = max(0.0, min(1.0, signals.rider_density / 10.0))
        duration_factor = max(0.0, min(1.0, signals.crowd_duration_minutes / 120.0))

        score = (
            0.45 * velocity_factor
            + 0.35 * density_factor
            + 0.20 * duration_factor
        )
        return round(score, 4)

    @staticmethod
    def _dynamic_duration_threshold(
        zone: ZoneContext,
        signals: CrowdSignals,
    ) -> float:
        """
        Dynamic duration threshold (minutes) for confirming a blockage.

        Base threshold is 30 min, scaled down in high-risk / dense zones
        and up in low-risk zones.
        """
        base_duration = 30.0
        # High zone_risk_score → lower threshold (quicker confirmation)
        dynamic = base_duration / zone.zone_risk_score
        # Also reduce for high density areas
        if signals.rider_density > 5.0:
            dynamic *= 0.8
        return round(max(10.0, dynamic), 1)

    # ------------------------------------------------------------------
    # 5 — Trust-Aware Logic
    # ------------------------------------------------------------------

    @staticmethod
    def _apply_trust_adjustment(confidence: float, trust_score: float) -> float:
        """
        Adjust confidence based on manager trust score.

        trust < 0.3  → downgrade by up to 15 pp
        trust > 0.9  → boost by up to 5 pp
        otherwise    → linear interpolation (neutral at 0.6)
        """
        if trust_score < 0.3:
            penalty = 0.15 * (0.3 - trust_score) / 0.3
            adjusted = confidence - penalty
        elif trust_score > 0.9:
            boost = 0.05 * (trust_score - 0.9) / 0.1
            adjusted = confidence + boost
        else:
            # slight linear nudge ±0 around 0.6 midpoint
            delta = (trust_score - 0.6) * 0.05
            adjusted = confidence + delta

        return round(max(0.0, min(1.0, adjusted)), 4)

    # ------------------------------------------------------------------
    # 6 — Multi-Signal Arbitration
    # ------------------------------------------------------------------

    def _arbitrate(
        self,
        *,
        manager_alert: ManagerAlert,
        route_response: RouteAPIResponse,
        adaptive_threshold: float,
        detour_percentile: float,
        velocity_percentile: float,
        crowd_signals: CrowdSignals,
        dynamic_duration_threshold: float,
        crowd_score: float,
        zone_context: ZoneContext,
    ) -> tuple[VerifiedStatus, float, DecisionSource]:
        """
        Core arbitration engine.

        Decision tree (priority order):
          A) Manager alert is OFF → UNVERIFIED with low confidence.
          B) API failed → fallback to crowd + historical signals.
          C) Manager alert is ON → evaluate PARTIAL vs CONFIRMED vs UNVERIFIED.
        """
        # ── A. No manager alert ─────────────────────────────────────────
        if not manager_alert.manager_alert_flag:
            logger.debug("No manager alert flag — returning UNVERIFIED.")
            return (
                VerifiedStatus.UNVERIFIED,
                0.25,
                DecisionSource.MANAGER_ONLY,
            )

        # ── B. API failure fallback ─────────────────────────────────────
        if not route_response.api_success:
            return self._fallback_arbitration(
                crowd_signals=crowd_signals,
                crowd_score=crowd_score,
                velocity_percentile=velocity_percentile,
                dynamic_duration_threshold=dynamic_duration_threshold,
                zone_context=zone_context,
            )

        # 🔥 FIX 6: Abuse Protection
        if getattr(manager_alert, "alerts_last_hour", 0) > 5:
            logger.warning("Manager %s is spamming alerts. Forcing UNVERIFIED.", manager_alert.manager_id)
            return (VerifiedStatus.UNVERIFIED, 0.05, DecisionSource.MANAGER_ONLY)

        # ── C. Full arbitration (route + crowd + manager) ───────────────
        detour = route_response.detour_distance
        route_status = route_response.route_status

        # 🔥 FIX 2: Explicitly handle CLEAR route
        if route_status == RouteStatus.CLEAR and crowd_score < 0.65:
            return (VerifiedStatus.UNVERIFIED, 0.15, DecisionSource.ROUTE_CROWD_MANAGER)

        # 🔥 FIX 5: Trust-based dynamic thresholds (Make it harder for low trust)
        trust = manager_alert.manager_trust_score
        vel_thresh = 20 if trust >= 0.3 else 10  
        pct_thresh = 40 if trust >= 0.3 else 25  

       # --- CONFIRMED conditions ---
        confirmed_route = detour >= adaptive_threshold or route_status == RouteStatus.BLOCKED
        confirmed_velocity = velocity_percentile < vel_thresh
        confirmed_duration = crowd_signals.crowd_duration_minutes > dynamic_duration_threshold

        # 🔥 FIX 3: Relaxed logic (OR instead of AND for velocity/duration if route is blocked)
        is_confirmed = confirmed_route and (
            confirmed_velocity or confirmed_duration or crowd_score > 0.70
        )

        # --- PARTIAL conditions ---
        partial_detour = 0 < detour < adaptive_threshold
        partial_percentile = detour_percentile < pct_thresh

        # 🔥 FIX 2: Fallback for huge detour but weak crowd
        huge_detour_weak_crowd = (detour >= adaptive_threshold) and (crowd_score < 0.5)

        # ── Evaluate ────────────────────────────────────────────────────
        if is_confirmed and not huge_detour_weak_crowd:
            confidence = self._confidence_confirmed(
                detour, adaptive_threshold, crowd_score, velocity_percentile
            )
            return (
                VerifiedStatus.CONFIRMED,
                confidence,
                DecisionSource.ROUTE_CROWD_MANAGER,
            )

        # 🔥 FIX 2: Added `huge_detour_weak_crowd` to trigger PARTIAL
        if (partial_detour and partial_percentile) or huge_detour_weak_crowd:
            confidence = self._confidence_partial(
                detour, adaptive_threshold, crowd_score
            )
            return (
                VerifiedStatus.PARTIAL,
                confidence,
                DecisionSource.ROUTE_CROWD_MANAGER,
            )

        # Borderline / conflicting signals
        confidence = self._confidence_unverified(crowd_score)
        return (
            VerifiedStatus.UNVERIFIED,
            confidence,
            DecisionSource.ROUTE_CROWD_MANAGER,
        )

    # ------------------------------------------------------------------
    # 6b — Fallback Arbitration (API down)
    # ------------------------------------------------------------------

    def _fallback_arbitration(
        self,
        *,
        crowd_signals: CrowdSignals,
        crowd_score: float,
        velocity_percentile: float,
        dynamic_duration_threshold: float,
        zone_context: ZoneContext,
    ) -> tuple[VerifiedStatus, float, DecisionSource]:
        """
        Arbitrate using crowd signals + historical likelihood when the
        route API is unavailable.
        """
        historical_likelihood = _HISTORICAL_DISRUPTION_LIKELIHOOD.get(
            zone_context.zone_type,
            _HISTORICAL_DISRUPTION_LIKELIHOOD["default"],
        )

        strong_crowd = crowd_score > 0.65
        slow_riders = velocity_percentile < 25
        long_duration = (
            crowd_signals.crowd_duration_minutes > dynamic_duration_threshold
        )

        if strong_crowd and slow_riders and long_duration:
            confidence = round(
                0.5 * crowd_score + 0.3 * historical_likelihood + 0.2 * (1 - velocity_percentile / 100),
                4,
            )
            return (
                VerifiedStatus.CONFIRMED,
                confidence,
                DecisionSource.HISTORICAL_CROWD_MANAGER,
            )

        if strong_crowd or (slow_riders and long_duration):
            confidence = round(
                0.4 * crowd_score + 0.3 * historical_likelihood + 0.1,
                4,
            )
            return (
                VerifiedStatus.PARTIAL,
                confidence,
                DecisionSource.CROWD_MANAGER,
            )

        confidence = round(0.2 * historical_likelihood + 0.1, 4)
        return (
            VerifiedStatus.UNVERIFIED,
            confidence,
            DecisionSource.HISTORICAL_CROWD_MANAGER,
        )

    # ------------------------------------------------------------------
    # Confidence Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _confidence_confirmed(
        detour: float,
        threshold: float,
        crowd_score: float,
        velocity_percentile: float,
    ) -> float:
        """Confidence score when CONFIRMED verdict is reached."""
        route_signal = min(1.0, detour / (threshold + 1e-9))
        velocity_signal = 1.0 - velocity_percentile / 100.0
        confidence = 0.40 * route_signal + 0.35 * crowd_score + 0.25 * velocity_signal
        return round(min(0.90, confidence), 4)  # 🔥 FIX 4: Cap at 0.90

    @staticmethod
    def _confidence_partial(
        detour: float,
        threshold: float,
        crowd_score: float,
    ) -> float:
        """Confidence score when PARTIAL verdict is reached."""
        route_signal = detour / (threshold + 1e-9)
        confidence = 0.55 * route_signal + 0.45 * crowd_score
        return round(min(0.85, max(0.30, confidence)), 4)

    @staticmethod
    def _confidence_unverified(crowd_score: float) -> float:
        """Confidence score when UNVERIFIED verdict is reached."""
        return round(min(0.45, 0.15 + 0.30 * crowd_score), 4)


# ---------------------------------------------------------------------------
# FastAPI Integration Helper
# ---------------------------------------------------------------------------

def build_json_response(result: VerificationResult) -> dict[str, Any]:
    """
    Convert a :class:`VerificationResult` into the canonical JSON payload
    expected by BHIMA ASTRA downstream consumers.
    """
    return {
        "verified_status": result.verified_status.value,
        "confidence_score": result.confidence_score,
        "decision_source": result.decision_source.value,
        "detour_distance": result.detour_distance,
        "adaptive_threshold": result.adaptive_threshold,
        "payout_multiplier": result.payout_multiplier, # 🔥 FIX 5: Feed to Policy Engine
        "audit_log": result.audit_log,
        "timestamp": result.timestamp,
        "manager_id": result.manager_id,
    }


# ---------------------------------------------------------------------------
# FastAPI Route Example (attach to your existing app)
# ---------------------------------------------------------------------------

# Uncomment and integrate into your FastAPI app:
#
# from fastapi import FastAPI
# from pydantic import BaseModel
#
# app = FastAPI(title="BHIMA ASTRA — Manager Intelligence Agent")
# _agent = ManagerIntelligenceAgent()
#
# class DisruptionRequest(BaseModel):
#     delivery_zone_lat: float
#     delivery_zone_lon: float
#     dark_store_lat: float
#     dark_store_lon: float
#     avg_rider_velocity: float
#     rider_density: float
#     crowd_duration_minutes: float
#     city_multiplier: float = 1.0
#     zone_risk_score: float = 1.0
#     zone_type: str = "default"
#     manager_id: str
#     manager_alert_flag: bool
#     manager_trust_score: float
#
# @app.post("/verify-disruption")
# async def verify_disruption(req: DisruptionRequest):
#     result = await _agent.verify_disruption(
#         delivery_zone_coords=Coordinates(req.delivery_zone_lat, req.delivery_zone_lon),
#         dark_store_coords=Coordinates(req.dark_store_lat, req.dark_store_lon),
#         crowd_signals=CrowdSignals(
#             avg_rider_velocity=req.avg_rider_velocity,
#             rider_density=req.rider_density,
#             crowd_duration_minutes=req.crowd_duration_minutes,
#         ),
#         zone_context=ZoneContext(
#             city_multiplier=req.city_multiplier,
#             zone_risk_score=req.zone_risk_score,
#             zone_type=req.zone_type,
#         ),
#         manager_alert=ManagerAlert(
#             manager_id=req.manager_id,
#             manager_alert_flag=req.manager_alert_flag,
#             manager_trust_score=req.manager_trust_score,
#             alerts_last_hour=req.alerts_last_hour,
#         ),
#     )
#     return build_json_response(result)


# ---------------------------------------------------------------------------
# Smoke test
# ---------------------------------------------------------------------------

async def _smoke_test() -> None:
    agent = ManagerIntelligenceAgent()

    scenarios = [
        {
            "label": "High-density confirmed blockage",
            "zone": ZoneContext(city_multiplier=1.4, zone_risk_score=1.8, zone_type="high_density"),
            "crowd": CrowdSignals(avg_rider_velocity=6.0, rider_density=8.5, crowd_duration_minutes=55),
            "alert": ManagerAlert(manager_id="MGR-001", manager_alert_flag=True, manager_trust_score=0.88),
        },
        {
            "label": "Partial detour — medium city",
            "zone": ZoneContext(city_multiplier=1.1, zone_risk_score=1.0, zone_type="medium_density"),
            "crowd": CrowdSignals(avg_rider_velocity=15.0, rider_density=3.5, crowd_duration_minutes=20),
            "alert": ManagerAlert(manager_id="MGR-042", manager_alert_flag=True, manager_trust_score=0.65),
        },
        {
            "label": "Low-trust manager — unverified",
            "zone": ZoneContext(city_multiplier=1.0, zone_risk_score=0.8, zone_type="low_density"),
            "crowd": CrowdSignals(avg_rider_velocity=22.0, rider_density=1.2, crowd_duration_minutes=8),
            "alert": ManagerAlert(manager_id="MGR-099", manager_alert_flag=True, manager_trust_score=0.18),
        },
        {
            "label": "No manager alert",
            "zone": ZoneContext(city_multiplier=1.0, zone_risk_score=1.0, zone_type="default"),
            "crowd": CrowdSignals(avg_rider_velocity=20.0, rider_density=2.0, crowd_duration_minutes=15),
            "alert": ManagerAlert(manager_id="MGR-007", manager_alert_flag=False, manager_trust_score=0.75),
        },
        {
            "label": "Spamming Manager — Abuse Protection",
            "zone": ZoneContext(city_multiplier=1.0, zone_risk_score=1.0, zone_type="medium_density"),
            "crowd": CrowdSignals(avg_rider_velocity=12.0, rider_density=5.0, crowd_duration_minutes=40),
            # 🔥 8 alerts in the last hour! System should force UNVERIFIED even if trust is 0.80
            "alert": ManagerAlert(manager_id="MGR-SPAM", manager_alert_flag=True, manager_trust_score=0.80, alerts_last_hour=8), 
        },
    ]

    origin = Coordinates(lat=17.385, lon=78.487)   # Hyderabad dark store
    dest   = Coordinates(lat=17.432, lon=78.502)   # delivery zone

    print("\n" + "=" * 70)
    print("  BHIMA ASTRA — Manager Intelligence Agent — Smoke Test")
    print("=" * 70)

    for s in scenarios:
        result = await agent.verify_disruption(
            delivery_zone_coords=dest,
            dark_store_coords=origin,
            crowd_signals=s["crowd"],
            zone_context=s["zone"],
            manager_alert=s["alert"],
        )
        payload = build_json_response(result)
        print(f"\n[{s['label']}]")
        print(f"  verified_status  : {payload['verified_status']}")
        print(f"  confidence_score : {payload['confidence_score']:.4f}")
        print(f"  decision_source  : {payload['decision_source']}")
        print(f"  detour_distance  : {payload['detour_distance']} km")
        print(f"  adaptive_thresh  : {payload['adaptive_threshold']} km")
        print(f"  audit steps      : {len(payload['audit_log'])}")
        print(f"  timestamp        : {payload['timestamp']}")

    print("\n" + "=" * 70 + "\n")


if __name__ == "__main__":
    asyncio.run(_smoke_test())