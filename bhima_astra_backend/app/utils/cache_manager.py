"""
Comprehensive Redis Cache Manager

Centralized caching for all major data types:
- Worker risk scores & income predictions
- Active policies & fraud holds
- Zone forecasts & live data
- Manager disruption flags
- City tier multipliers
- System metadata

Cache TTLs optimized for trade-off between freshness and performance.
"""

import json
import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from app.utils.redis_client import redis_client

logger = logging.getLogger("bhima.cache_manager")


# ═══════════════════════════════════════════════════════════════════════════
# CACHE CONFIGURATION - TTLs (in seconds)
# ═══════════════════════════════════════════════════════════════════════════

CACHE_TTL = {
    # Real-time data (short TTL - frequently changes)
    "zone_live": 300,  # 5 min  - Weather + traffic real-time
    "worker_income_prediction": 600,  # 10 min - Income changes frequently
    "fraud_hold_status": 3600,  # 1 hour - Holds are time-based
    "admin_stats": 30,  # 30 sec - KPIs polled every 30s by WebSocket
    "admin_triggers": 120,  # 2 min  - Recent trigger event list
    "admin_fraud_alerts": 60,  # 1 min  - Fraud alert feed
    "admin_activity": 60,  # 1 min  - Audit activity feed
    # Medium-term data (medium TTL)
    "worker_risk_score": 1800,  # 30 min - Risk scores update hourly
    "active_policy": 1800,  # 30 min - Policy changes less often
    "zone_forecast": 3600,  # 1 hour - Forecasts don't change hourly
    "premium_calculation": 1800,  # 30 min - Ridge model output per worker+plan
    "actuarial_pipeline": 900,  # 15 min - Chained income+risk+premium result
    "plan_comparison": 3600,  # 1 hour - City-adjusted plan data per tier
    # Static/slow-changing data (long TTL)
    "worker_profile": 7200,  # 2 hours  - Profile data stable
    "city_multiplier": 86400,  # 24 hours - Rarely changes
    "manager_disruption_flag": 3600,  # 1 hour   - Flags are temporary
    "zone_history": 7200,  # 2 hours  - History stable
    "fraud_score": 172800,  # 48 hours - Claim fraud score (hold period)
    # Financial safety
    "circuit_breaker_total": 604800,  # 7 days  - Weekly payout pool accumulator
    "circuit_breaker_status": 3600,  # 1 hour  - open / closed state
    # Security
    "otp_rate_limit": 3600,  # 1 hour  - OTP attempts per phone (max 5/hr)
    "api_rate_limit": 60,  # 1 min   - API calls per worker sliding window
    # System metadata (very long TTL)
    "system_metadata": 86400,  # 24 hours
}


# ═══════════════════════════════════════════════════════════════════════════
# WORKER CACHE
# ═══════════════════════════════════════════════════════════════════════════


class WorkerCache:
    """Cache for worker-specific data."""

    @staticmethod
    def set_risk_score(worker_id: int, risk_data: Dict[str, Any]) -> bool:
        """
        Cache worker risk score from ML model.

        Args:
            worker_id: Worker ID
            risk_data: Dict with zone_risk_score, fraud_risk_score, etc.

        Returns:
            True if successful
        """
        try:
            key = f"worker:risk:{worker_id}"
            redis_client.setex(
                key, CACHE_TTL["worker_risk_score"], json.dumps(risk_data)
            )
            logger.debug(f"[CACHE] Cached worker risk score: {worker_id}")
            return True
        except Exception as e:
            logger.debug(f"[CACHE] Failed to cache worker risk: {e}")
            return False

    @staticmethod
    def get_risk_score(worker_id: int) -> Optional[Dict[str, Any]]:
        """Get cached worker risk score."""
        try:
            key = f"worker:risk:{worker_id}"
            cached = redis_client.get(key)
            if cached:
                logger.debug(f"[CACHE HIT] Worker risk score: {worker_id}")
                return json.loads(cached)
            return None
        except Exception as e:
            logger.debug(f"[CACHE] Failed to get worker risk: {e}")
            return None

    @staticmethod
    def set_income_prediction(worker_id: int, income_data: Dict[str, Any]) -> bool:
        """
        Cache worker income prediction from ML model.

        Args:
            worker_id: Worker ID
            income_data: Dict with expected_income, confidence, etc.

        Returns:
            True if successful
        """
        try:
            key = f"worker:income:{worker_id}"
            redis_client.setex(
                key, CACHE_TTL["worker_income_prediction"], json.dumps(income_data)
            )
            logger.debug(f"[CACHE] Cached worker income prediction: {worker_id}")
            return True
        except Exception as e:
            logger.debug(f"[CACHE] Failed to cache worker income: {e}")
            return False

    @staticmethod
    def get_income_prediction(worker_id: int) -> Optional[Dict[str, Any]]:
        """Get cached worker income prediction."""
        try:
            key = f"worker:income:{worker_id}"
            cached = redis_client.get(key)
            if cached:
                logger.debug(f"[CACHE HIT] Worker income prediction: {worker_id}")
                return json.loads(cached)
            return None
        except Exception as e:
            logger.debug(f"[CACHE] Failed to get worker income: {e}")
            return None

    @staticmethod
    def set_profile(worker_id: int, profile_data: Dict[str, Any]) -> bool:
        """Cache worker profile information."""
        try:
            key = f"worker:profile:{worker_id}"
            redis_client.setex(
                key, CACHE_TTL["worker_profile"], json.dumps(profile_data)
            )
            logger.debug(f"[CACHE] Cached worker profile: {worker_id}")
            return True
        except Exception as e:
            logger.debug(f"[CACHE] Failed to cache worker profile: {e}")
            return False

    @staticmethod
    def get_profile(worker_id: int) -> Optional[Dict[str, Any]]:
        """Get cached worker profile."""
        try:
            key = f"worker:profile:{worker_id}"
            cached = redis_client.get(key)
            if cached:
                logger.debug(f"[CACHE HIT] Worker profile: {worker_id}")
                return json.loads(cached)
            return None
        except Exception as e:
            logger.debug(f"[CACHE] Failed to get worker profile: {e}")
            return None

    @staticmethod
    def invalidate(worker_id: int) -> int:
        """Invalidate all cache keys for a worker."""
        try:
            keys_to_delete = [
                f"worker:risk:{worker_id}",
                f"worker:income:{worker_id}",
                f"worker:profile:{worker_id}",
                f"worker:policy:{worker_id}",
            ]
            deleted = 0
            for key in keys_to_delete:
                if redis_client.delete(key):
                    deleted += 1
            logger.info(f"[CACHE] Invalidated {deleted} keys for worker {worker_id}")
            return deleted
        except Exception as e:
            logger.debug(f"[CACHE] Failed to invalidate worker cache: {e}")
            return 0


# ═══════════════════════════════════════════════════════════════════════════
# POLICY CACHE
# ═══════════════════════════════════════════════════════════════════════════


class PolicyCache:
    """Cache for policy-specific data."""

    @staticmethod
    def set_active_policy(worker_id: int, policy_data: Dict[str, Any]) -> bool:
        """Cache active policy for a worker."""
        try:
            key = f"policy:active:{worker_id}"
            redis_client.setex(key, CACHE_TTL["active_policy"], json.dumps(policy_data))
            logger.debug(f"[CACHE] Cached active policy for worker: {worker_id}")
            return True
        except Exception as e:
            logger.debug(f"[CACHE] Failed to cache active policy: {e}")
            return False

    @staticmethod
    def get_active_policy(worker_id: int) -> Optional[Dict[str, Any]]:
        """Get cached active policy."""
        try:
            key = f"policy:active:{worker_id}"
            cached = redis_client.get(key)
            if cached:
                logger.debug(f"[CACHE HIT] Active policy for worker: {worker_id}")
                return json.loads(cached)
            return None
        except Exception as e:
            logger.debug(f"[CACHE] Failed to get active policy: {e}")
            return None

    @staticmethod
    def invalidate_policy(worker_id: int) -> bool:
        """Invalidate policy cache for a worker."""
        try:
            key = f"policy:active:{worker_id}"
            redis_client.delete(key)
            logger.info(f"[CACHE] Invalidated policy for worker: {worker_id}")
            return True
        except Exception as e:
            logger.debug(f"[CACHE] Failed to invalidate policy: {e}")
            return False


# ═══════════════════════════════════════════════════════════════════════════
# ZONE CACHE
# ═══════════════════════════════════════════════════════════════════════════


class ZoneCache:
    """Cache for zone-specific data."""

    @staticmethod
    def set_live_data(zone_id: str, zone_data: Dict[str, Any]) -> bool:
        """Cache zone live data (weather, risk, etc.)."""
        try:
            key = f"zone:live:{zone_id}"
            redis_client.setex(key, CACHE_TTL["zone_live"], json.dumps(zone_data))
            logger.debug(f"[CACHE] Cached zone live data: {zone_id}")
            return True
        except Exception as e:
            logger.debug(f"[CACHE] Failed to cache zone live data: {e}")
            return False

    @staticmethod
    def get_live_data(zone_id: str) -> Optional[Dict[str, Any]]:
        """Get cached zone live data."""
        try:
            key = f"zone:live:{zone_id}"
            cached = redis_client.get(key)
            if cached:
                logger.debug(f"[CACHE HIT] Zone live data: {zone_id}")
                return json.loads(cached)
            return None
        except Exception as e:
            logger.debug(f"[CACHE] Failed to get zone live data: {e}")
            return None

    @staticmethod
    def set_forecast(zone_id: str, forecast_data: List[Dict]) -> bool:
        """Cache zone 7-day forecast."""
        try:
            key = f"zone:forecast:{zone_id}"
            redis_client.setex(
                key, CACHE_TTL["zone_forecast"], json.dumps(forecast_data)
            )
            logger.debug(f"[CACHE] Cached zone forecast: {zone_id}")
            return True
        except Exception as e:
            logger.debug(f"[CACHE] Failed to cache zone forecast: {e}")
            return False

    @staticmethod
    def get_forecast(zone_id: str) -> Optional[List[Dict]]:
        """Get cached zone forecast."""
        try:
            key = f"zone:forecast:{zone_id}"
            cached = redis_client.get(key)
            if cached:
                logger.debug(f"[CACHE HIT] Zone forecast: {zone_id}")
                return json.loads(cached)
            return None
        except Exception as e:
            logger.debug(f"[CACHE] Failed to get zone forecast: {e}")
            return None

    @staticmethod
    def set_history(zone_id: str, history_data: List[Dict]) -> bool:
        """Cache zone historical data (7/30 day lookback)."""
        try:
            key = f"zone:history:{zone_id}"
            redis_client.setex(key, CACHE_TTL["zone_history"], json.dumps(history_data))
            logger.debug(f"[CACHE] Cached zone history: {zone_id}")
            return True
        except Exception as e:
            logger.debug(f"[CACHE] Failed to cache zone history: {e}")
            return False

    @staticmethod
    def get_history(zone_id: str) -> Optional[List[Dict]]:
        """Get cached zone history."""
        try:
            key = f"zone:history:{zone_id}"
            cached = redis_client.get(key)
            if cached:
                logger.debug(f"[CACHE HIT] Zone history: {zone_id}")
                return json.loads(cached)
            return None
        except Exception as e:
            logger.debug(f"[CACHE] Failed to get zone history: {e}")
            return None

    @staticmethod
    def invalidate(zone_id: str) -> int:
        """Invalidate all cache keys for a zone."""
        try:
            keys_to_delete = [
                f"zone:live:{zone_id}",
                f"zone:forecast:{zone_id}",
                f"zone:history:{zone_id}",
            ]
            deleted = 0
            for key in keys_to_delete:
                if redis_client.delete(key):
                    deleted += 1
            logger.info(f"[CACHE] Invalidated {deleted} keys for zone {zone_id}")
            return deleted
        except Exception as e:
            logger.debug(f"[CACHE] Failed to invalidate zone cache: {e}")
            return 0


# ═══════════════════════════════════════════════════════════════════════════
# FRAUD CACHE
# ═══════════════════════════════════════════════════════════════════════════


class FraudCache:
    """Cache for fraud-related data."""

    @staticmethod
    def set_hold_status(claim_id: int, hold_data: Dict[str, Any]) -> bool:
        """Cache fraud hold status (48h)."""
        try:
            key = f"fraud:hold:{claim_id}"
            redis_client.setex(
                key, CACHE_TTL["fraud_hold_status"], json.dumps(hold_data)
            )
            logger.debug(f"[CACHE] Cached fraud hold: {claim_id}")
            return True
        except Exception as e:
            logger.debug(f"[CACHE] Failed to cache fraud hold: {e}")
            return False

    @staticmethod
    def get_hold_status(claim_id: int) -> Optional[Dict[str, Any]]:
        """Get cached fraud hold status."""
        try:
            key = f"fraud:hold:{claim_id}"
            cached = redis_client.get(key)
            if cached:
                logger.debug(f"[CACHE HIT] Fraud hold status: {claim_id}")
                return json.loads(cached)
            return None
        except Exception as e:
            logger.debug(f"[CACHE] Failed to get fraud hold: {e}")
            return None

    @staticmethod
    def release_hold(claim_id: int) -> bool:
        """Release a fraudhold from cache."""
        try:
            key = f"fraud:hold:{claim_id}"
            redis_client.delete(key)
            logger.info(f"[CACHE] Released fraud hold: {claim_id}")
            return True
        except Exception as e:
            logger.debug(f"[CACHE] Failed to release fraud hold: {e}")
            return False


# ═══════════════════════════════════════════════════════════════════════════
# MANAGER/ADMIN CACHE
# ═══════════════════════════════════════════════════════════════════════════


class ManagerCache:
    """Cache for manager flags and disruption data."""

    @staticmethod
    def set_disruption_flag(flag_id: int, flag_data: Dict[str, Any]) -> bool:
        """Cache manager disruption flag."""
        try:
            key = f"flag:disruption:{flag_id}"
            redis_client.setex(
                key, CACHE_TTL["manager_disruption_flag"], json.dumps(flag_data)
            )
            logger.debug(f"[CACHE] Cached disruption flag: {flag_id}")
            return True
        except Exception as e:
            logger.debug(f"[CACHE] Failed to cache disruption flag: {e}")
            return False

    @staticmethod
    def get_disruption_flag(flag_id: int) -> Optional[Dict[str, Any]]:
        """Get cached disruption flag."""
        try:
            key = f"flag:disruption:{flag_id}"
            cached = redis_client.get(key)
            if cached:
                logger.debug(f"[CACHE HIT] Disruption flag: {flag_id}")
                return json.loads(cached)
            return None
        except Exception as e:
            logger.debug(f"[CACHE] Failed to get disruption flag: {e}")
            return None

    @staticmethod
    def set_zone_flags(zone_id: str, flags_data: List[Dict]) -> bool:
        """Cache all verified flags for a zone."""
        try:
            key = f"flag:zone:{zone_id}"
            redis_client.setex(
                key, CACHE_TTL["manager_disruption_flag"], json.dumps(flags_data)
            )
            logger.debug(f"[CACHE] Cached zone flags: {zone_id}")
            return True
        except Exception as e:
            logger.debug(f"[CACHE] Failed to cache zone flags: {e}")
            return False

    @staticmethod
    def get_zone_flags(zone_id: str) -> Optional[List[Dict]]:
        """Get cached flags for a zone."""
        try:
            key = f"flag:zone:{zone_id}"
            cached = redis_client.get(key)
            if cached:
                logger.debug(f"[CACHE HIT] Zone flags: {zone_id}")
                return json.loads(cached)
            return None
        except Exception as e:
            logger.debug(f"[CACHE] Failed to get zone flags: {e}")
            return None


# ═══════════════════════════════════════════════════════════════════════════
# SYSTEM CONFIG CACHE
# ═══════════════════════════════════════════════════════════════════════════


class SystemCache:
    """Cache for system-wide configuration."""

    @staticmethod
    def set_city_multipliers(city_multipliers: Dict[str, float]) -> bool:
        """Cache city tier multipliers."""
        try:
            key = "system:city_multipliers"
            redis_client.setex(
                key, CACHE_TTL["city_multiplier"], json.dumps(city_multipliers)
            )
            logger.debug(f"[CACHE] Cached city multipliers")
            return True
        except Exception as e:
            logger.debug(f"[CACHE] Failed to cache city multipliers: {e}")
            return False

    @staticmethod
    def get_city_multipliers() -> Optional[Dict[str, float]]:
        """Get cached city tier multipliers."""
        try:
            key = "system:city_multipliers"
            cached = redis_client.get(key)
            if cached:
                logger.debug(f"[CACHE HIT] City multipliers")
                return json.loads(cached)
            return None
        except Exception as e:
            logger.debug(f"[CACHE] Failed to get city multipliers: {e}")
            return None

    @staticmethod
    def set_system_metadata(metadata: Dict[str, Any]) -> bool:
        """Cache system metadata (counts, stats, etc.)."""
        try:
            key = "system:metadata"
            redis_client.setex(key, CACHE_TTL["system_metadata"], json.dumps(metadata))
            logger.debug(f"[CACHE] Cached system metadata")
            return True
        except Exception as e:
            logger.debug(f"[CACHE] Failed to cache system metadata: {e}")
            return False

    @staticmethod
    def get_system_metadata() -> Optional[Dict[str, Any]]:
        """Get cached system metadata."""
        try:
            key = "system:metadata"
            cached = redis_client.get(key)
            if cached:
                logger.debug(f"[CACHE HIT] System metadata")
                return json.loads(cached)
            return None
        except Exception as e:
            logger.debug(f"[CACHE] Failed to get system metadata: {e}")
            return None


# ═══════════════════════════════════════════════════════════════════════════
# CACHE STATS & MANAGEMENT
# ═══════════════════════════════════════════════════════════════════════════

# ═══════════════════════════════════════════════════════════════════════════
# PREMIUM CACHE
# ═══════════════════════════════════════════════════════════════════════════


class PremiumCache:
    """
    Cache for Ridge Regression premium calculations.

    calculate_premium() chains 3 DB queries + StandardScaler + Ridge model.
    Result is deterministic for the same worker_id + plan_tier within a 30-min
    window, so caching eliminates the heaviest actuarial computation on the
    hot /worker/dashboard and onboarding paths.

    Key:  premium:{worker_id}:{plan_tier}
    TTL:  30 minutes
    Invalidate on: worker profile update, plan change, city-tier multiplier change
    """

    @staticmethod
    def set(worker_id: int, plan_tier: str, result: Dict[str, Any]) -> bool:
        try:
            key = f"premium:{worker_id}:{plan_tier or 'auto'}"
            redis_client.setex(
                key, CACHE_TTL["premium_calculation"], json.dumps(result)
            )
            logger.debug(f"[CACHE] Cached premium: worker={worker_id} plan={plan_tier}")
            return True
        except Exception as e:
            logger.debug(f"[CACHE] Failed to cache premium: {e}")
            return False

    @staticmethod
    def get(worker_id: int, plan_tier: str) -> Optional[Dict[str, Any]]:
        try:
            key = f"premium:{worker_id}:{plan_tier or 'auto'}"
            cached = redis_client.get(key)
            if cached:
                logger.debug(
                    f"[CACHE HIT] Premium: worker={worker_id} plan={plan_tier}"
                )
                return json.loads(cached)
            return None
        except Exception as e:
            logger.debug(f"[CACHE] Failed to get premium: {e}")
            return None

    @staticmethod
    def invalidate(worker_id: int) -> int:
        """Invalidate all plan tiers for a worker (e.g. after profile update)."""
        try:
            pattern = f"premium:{worker_id}:*"
            keys = redis_client.keys(pattern)
            deleted = redis_client.delete(*keys) if keys else 0
            if deleted:
                logger.info(
                    f"[CACHE] Invalidated {deleted} premium keys for worker {worker_id}"
                )
            return deleted
        except Exception as e:
            logger.debug(f"[CACHE] Failed to invalidate premium: {e}")
            return 0


# ═══════════════════════════════════════════════════════════════════════════
# FRAUD SCORE CACHE
# ═══════════════════════════════════════════════════════════════════════════


class FraudScoreCache:
    """
    Cache for completed 4-stage fraud pipeline results.

    run_fraud_check() runs 5+ DB queries + XGBoost + NetworkX graph lookup.
    A claim's fraud determination is immutable once set (only admin can override),
    so the 48-hour hold window is the natural TTL — matching the hold release timer.

    Key:  fraud:score:{claim_id}
    TTL:  48 hours (172800 s) — matches hold release window
    Invalidate on: admin manual override, hold release
    """

    @staticmethod
    def set(claim_id: int, result: Dict[str, Any]) -> bool:
        try:
            key = f"fraud:score:{claim_id}"
            redis_client.setex(key, CACHE_TTL["fraud_score"], json.dumps(result))
            logger.debug(f"[CACHE] Cached fraud score: claim={claim_id}")
            return True
        except Exception as e:
            logger.debug(f"[CACHE] Failed to cache fraud score: {e}")
            return False

    @staticmethod
    def get(claim_id: int) -> Optional[Dict[str, Any]]:
        try:
            key = f"fraud:score:{claim_id}"
            cached = redis_client.get(key)
            if cached:
                logger.debug(f"[CACHE HIT] Fraud score: claim={claim_id}")
                return json.loads(cached)
            return None
        except Exception as e:
            logger.debug(f"[CACHE] Failed to get fraud score: {e}")
            return None

    @staticmethod
    def invalidate(claim_id: int) -> bool:
        """Remove cached score on admin override or hold release."""
        try:
            redis_client.delete(f"fraud:score:{claim_id}")
            logger.info(f"[CACHE] Invalidated fraud score: claim={claim_id}")
            return True
        except Exception as e:
            logger.debug(f"[CACHE] Failed to invalidate fraud score: {e}")
            return False


# ═══════════════════════════════════════════════════════════════════════════
# ADMIN STATS CACHE
# ═══════════════════════════════════════════════════════════════════════════


class AdminStatsCache:
    """
    Cache for admin dashboard KPIs and live feed data.

    The admin WebSocket polls /admin/dashboard/kpis every 30 seconds and
    /admin/live/triggers every 2 minutes. Each query runs 4–6 aggregate SQL
    statements over large tables. Caching at the service layer eliminates the
    DB fan-out while keeping the dashboard within 1 poll-cycle of real data.

    Keys:
      admin:kpis                 TTL 30 s
      admin:triggers             TTL 2 min
      admin:fraud_alerts         TTL 1 min
      admin:recent_activity      TTL 1 min
    """

    @staticmethod
    def set_kpis(kpi_data: Dict[str, Any]) -> bool:
        try:
            redis_client.setex(
                "admin:kpis", CACHE_TTL["admin_stats"], json.dumps(kpi_data)
            )
            logger.debug("[CACHE] Cached admin KPIs")
            return True
        except Exception as e:
            logger.debug(f"[CACHE] Failed to cache admin KPIs: {e}")
            return False

    @staticmethod
    def get_kpis() -> Optional[Dict[str, Any]]:
        try:
            cached = redis_client.get("admin:kpis")
            if cached:
                logger.debug("[CACHE HIT] Admin KPIs")
                return json.loads(cached)
            return None
        except Exception as e:
            logger.debug(f"[CACHE] Failed to get admin KPIs: {e}")
            return None

    @staticmethod
    def set_triggers(triggers: List[Dict]) -> bool:
        try:
            redis_client.setex(
                "admin:triggers", CACHE_TTL["admin_triggers"], json.dumps(triggers)
            )
            logger.debug("[CACHE] Cached admin triggers")
            return True
        except Exception as e:
            logger.debug(f"[CACHE] Failed to cache admin triggers: {e}")
            return False

    @staticmethod
    def get_triggers() -> Optional[List[Dict]]:
        try:
            cached = redis_client.get("admin:triggers")
            if cached:
                logger.debug("[CACHE HIT] Admin triggers")
                return json.loads(cached)
            return None
        except Exception as e:
            logger.debug(f"[CACHE] Failed to get admin triggers: {e}")
            return None

    @staticmethod
    def set_fraud_alerts(alerts: List[Dict]) -> bool:
        try:
            redis_client.setex(
                "admin:fraud_alerts",
                CACHE_TTL["admin_fraud_alerts"],
                json.dumps(alerts),
            )
            logger.debug("[CACHE] Cached admin fraud alerts")
            return True
        except Exception as e:
            logger.debug(f"[CACHE] Failed to cache fraud alerts: {e}")
            return False

    @staticmethod
    def get_fraud_alerts() -> Optional[List[Dict]]:
        try:
            cached = redis_client.get("admin:fraud_alerts")
            if cached:
                logger.debug("[CACHE HIT] Admin fraud alerts")
                return json.loads(cached)
            return None
        except Exception as e:
            logger.debug(f"[CACHE] Failed to get fraud alerts: {e}")
            return None

    @staticmethod
    def set_recent_activity(activity: List[Dict]) -> bool:
        try:
            redis_client.setex(
                "admin:recent_activity",
                CACHE_TTL["admin_activity"],
                json.dumps(activity),
            )
            logger.debug("[CACHE] Cached admin recent activity")
            return True
        except Exception as e:
            logger.debug(f"[CACHE] Failed to cache recent activity: {e}")
            return False

    @staticmethod
    def get_recent_activity() -> Optional[List[Dict]]:
        try:
            cached = redis_client.get("admin:recent_activity")
            if cached:
                logger.debug("[CACHE HIT] Admin recent activity")
                return json.loads(cached)
            return None
        except Exception as e:
            logger.debug(f"[CACHE] Failed to get recent activity: {e}")
            return None

    @staticmethod
    def invalidate_all() -> int:
        """Bust all admin caches (e.g. after a payout or flag event)."""
        try:
            keys = [
                "admin:kpis",
                "admin:triggers",
                "admin:fraud_alerts",
                "admin:recent_activity",
            ]
            deleted = redis_client.delete(*keys)
            logger.info(f"[CACHE] Invalidated {deleted} admin stat keys")
            return deleted
        except Exception as e:
            logger.debug(f"[CACHE] Failed to invalidate admin stats: {e}")
            return 0


# ═══════════════════════════════════════════════════════════════════════════
# RATE LIMIT CACHE
# ═══════════════════════════════════════════════════════════════════════════


class RateLimitCache:
    """
    Redis-backed rate limiting for security-critical endpoints.

    OTP endpoint  : max 5 requests per phone per hour.
                    Uses a counter key with 1-hour TTL; increments on each
                    request and rejects when count > MAX_OTP_PER_HOUR.

    API endpoints : sliding 60-second window per worker_id.
                    Uses INCR + EXPIRE; caller enforces max_per_minute.

    Keys:
      ratelimit:otp:{phone}          TTL 1 hour   (integer counter)
      ratelimit:api:{worker_id}      TTL 1 minute (integer counter)
    """

    MAX_OTP_PER_HOUR: int = 5
    MAX_API_PER_MINUTE: int = 100

    @staticmethod
    def check_and_increment_otp(phone: str) -> Dict[str, Any]:
        """
        Check OTP rate limit for a phone number and increment the counter.

        Returns:
            {
                "allowed": bool,
                "count": int,        # current attempt count this hour
                "remaining": int,    # attempts left before block
                "reset_in_seconds": int
            }
        """
        try:
            key = f"ratelimit:otp:{phone}"
            count = redis_client.incr(key)
            if count == 1:
                # First request this window — set the TTL
                redis_client.expire(key, CACHE_TTL["otp_rate_limit"])

            ttl = redis_client.ttl(key)
            remaining = max(0, RateLimitCache.MAX_OTP_PER_HOUR - count)
            allowed = count <= RateLimitCache.MAX_OTP_PER_HOUR

            if not allowed:
                logger.warning(f"[RATE LIMIT] OTP blocked: phone={phone} count={count}")

            return {
                "allowed": allowed,
                "count": int(count),
                "remaining": remaining,
                "reset_in_seconds": int(ttl)
                if ttl > 0
                else CACHE_TTL["otp_rate_limit"],
            }
        except Exception as e:
            logger.error(f"[CACHE] OTP rate limit check failed: {e}")
            # Fail open — don't block on Redis error
            return {
                "allowed": True,
                "count": 0,
                "remaining": RateLimitCache.MAX_OTP_PER_HOUR,
                "reset_in_seconds": 3600,
            }

    @staticmethod
    def get_otp_status(phone: str) -> Dict[str, Any]:
        """Check current OTP rate limit status without incrementing."""
        try:
            key = f"ratelimit:otp:{phone}"
            count = int(redis_client.get(key) or 0)
            ttl = redis_client.ttl(key)
            return {
                "count": count,
                "remaining": max(0, RateLimitCache.MAX_OTP_PER_HOUR - count),
                "reset_in_seconds": int(ttl) if ttl > 0 else 0,
                "blocked": count >= RateLimitCache.MAX_OTP_PER_HOUR,
            }
        except Exception as e:
            logger.debug(f"[CACHE] Failed to get OTP status: {e}")
            return {
                "count": 0,
                "remaining": RateLimitCache.MAX_OTP_PER_HOUR,
                "blocked": False,
            }

    @staticmethod
    def check_and_increment_api(worker_id: int) -> Dict[str, Any]:
        """
        Check API rate limit for a worker (100 req/min sliding window).

        Returns:
            {"allowed": bool, "count": int, "remaining": int, "reset_in_seconds": int}
        """
        try:
            key = f"ratelimit:api:{worker_id}"
            count = redis_client.incr(key)
            if count == 1:
                redis_client.expire(key, CACHE_TTL["api_rate_limit"])

            ttl = redis_client.ttl(key)
            remaining = max(0, RateLimitCache.MAX_API_PER_MINUTE - count)
            allowed = count <= RateLimitCache.MAX_API_PER_MINUTE

            if not allowed:
                logger.warning(
                    f"[RATE LIMIT] API blocked: worker={worker_id} count={count}"
                )

            return {
                "allowed": allowed,
                "count": int(count),
                "remaining": remaining,
                "reset_in_seconds": int(ttl)
                if ttl > 0
                else CACHE_TTL["api_rate_limit"],
            }
        except Exception as e:
            logger.error(f"[CACHE] API rate limit check failed: {e}")
            return {
                "allowed": True,
                "count": 0,
                "remaining": RateLimitCache.MAX_API_PER_MINUTE,
                "reset_in_seconds": 60,
            }

    @staticmethod
    def reset_otp(phone: str) -> bool:
        """Reset OTP counter (admin use only)."""
        try:
            redis_client.delete(f"ratelimit:otp:{phone}")
            logger.info(f"[CACHE] OTP rate limit reset for phone={phone}")
            return True
        except Exception as e:
            logger.debug(f"[CACHE] Failed to reset OTP rate limit: {e}")
            return False


# ═══════════════════════════════════════════════════════════════════════════
# CIRCUIT BREAKER CACHE
# ═══════════════════════════════════════════════════════════════════════════


class CircuitBreakerCache:
    """
    Redis-backed weekly payout pool circuit breaker.

    Tracks cumulative payout disbursements within the current 7-day policy
    window. When total payouts exceed 80 % of the configured risk pool the
    breaker opens and the Payout Agent pauses all new disbursements.

    Keys:
      circuit:weekly_total       float  — running ₹ sum this week (TTL 7 days)
      circuit:status             str    — "closed" | "open" | "paused"
      circuit:pool_limit         float  — configured max pool (set by admin)

    Default pool limit: ₹10,000,000 (₹1 crore) — override via set_pool_limit().
    Threshold: 80 % of pool_limit triggers OPEN state.
    """

    DEFAULT_POOL_LIMIT: float = 10_000_000.0  # ₹1 crore
    TRIP_THRESHOLD: float = 0.80  # 80 % of pool

    @staticmethod
    def add_payout(amount: float) -> Dict[str, Any]:
        """
        Accumulate a payout into the weekly running total.
        Returns breaker state after accumulation.

        Returns:
            {
                "weekly_total": float,
                "pool_limit": float,
                "utilisation_pct": float,
                "status": "closed" | "open",
                "tripped": bool   — True if this payment caused the trip
            }
        """
        try:
            total_key = "circuit:weekly_total"
            status_key = "circuit:status"
            limit_key = "circuit:pool_limit"

            # Accumulate
            new_total = redis_client.incrbyfloat(total_key, amount)
            # Set TTL on first write in the window
            if redis_client.ttl(total_key) < 0:
                redis_client.expire(total_key, CACHE_TTL["circuit_breaker_total"])

            pool_limit = float(
                redis_client.get(limit_key) or CircuitBreakerCache.DEFAULT_POOL_LIMIT
            )
            utilisation = new_total / pool_limit if pool_limit > 0 else 0.0

            tripped = False
            # Handle both bytes and string return types
            status_raw = redis_client.get(status_key) or b"closed"
            if isinstance(status_raw, bytes):
                current_status = status_raw.decode()
            else:
                current_status = status_raw
                
            if utilisation >= CircuitBreakerCache.TRIP_THRESHOLD:
                if current_status != "open":
                    redis_client.setex(
                        status_key, CACHE_TTL["circuit_breaker_status"], "open"
                    )
                    tripped = True
                    logger.critical(
                        f"[CIRCUIT BREAKER] TRIPPED — weekly payouts=₹{new_total:,.2f} "
                        f"({utilisation:.1%} of pool). All payouts PAUSED."
                    )
                status = "open"
            else:
                redis_client.setex(
                    status_key, CACHE_TTL["circuit_breaker_status"], "closed"
                )
                status = "closed"

            return {
                "weekly_total": float(new_total),
                "pool_limit": float(pool_limit),
                "utilisation_pct": round(utilisation * 100, 2),
                "status": status,
                "tripped": tripped,
            }
        except Exception as e:
            logger.error(f"[CACHE] Circuit breaker add_payout failed: {e}")
            # Fail open — don't block payments on Redis error
            return {
                "weekly_total": 0,
                "pool_limit": CircuitBreakerCache.DEFAULT_POOL_LIMIT,
                "utilisation_pct": 0,
                "status": "closed",
                "tripped": False,
            }

    @staticmethod
    def get_status() -> Dict[str, Any]:
        """Get current circuit breaker status without modifying state."""
        try:
            total = float(redis_client.get("circuit:weekly_total") or 0)
            pool_raw = redis_client.get("circuit:pool_limit")
            pool = (
                float(pool_raw) if pool_raw else CircuitBreakerCache.DEFAULT_POOL_LIMIT
            )
            status_raw = redis_client.get("circuit:status")
            # Handle both bytes and string return types
            if isinstance(status_raw, bytes):
                status = status_raw.decode()
            else:
                status = status_raw or "closed"
            utilisation = total / pool if pool > 0 else 0.0
            return {
                "weekly_total": total,
                "pool_limit": pool,
                "utilisation_pct": round(utilisation * 100, 2),
                "status": status,
                "tripped": status == "open",
            }
        except Exception as e:
            logger.error(f"[CACHE] Circuit breaker get_status failed: {e}")
            return {"status": "closed", "tripped": False, "utilisation_pct": 0}

    @staticmethod
    def is_open() -> bool:
        """Fast check — returns True when circuit is open (payouts paused)."""
        try:
            status = redis_client.get("circuit:status")
            if status is None:
                return False
            # Handle both bytes and string return types
            if isinstance(status, bytes):
                status = status.decode()
            return status == "open"
        except Exception as e:
            logger.error(f"[CACHE] Circuit breaker is_open check failed: {e}")
            return False  # Fail open

    @staticmethod
    def reset(admin_id: int = 0) -> bool:
        """Admin manually resets the circuit breaker."""
        try:
            redis_client.delete("circuit:status")
            redis_client.setex(
                "circuit:status", CACHE_TTL["circuit_breaker_status"], "closed"
            )
            logger.warning(f"[CIRCUIT BREAKER] Manually reset by admin_id={admin_id}")
            return True
        except Exception as e:
            logger.debug(f"[CACHE] Failed to reset circuit breaker: {e}")
            return False

    @staticmethod
    def set_pool_limit(limit: float) -> bool:
        """Admin sets the weekly risk pool size."""
        try:
            redis_client.set("circuit:pool_limit", str(limit))
            logger.info(f"[CIRCUIT BREAKER] Pool limit updated: ₹{limit:,.2f}")
            return True
        except Exception as e:
            logger.debug(f"[CACHE] Failed to set pool limit: {e}")
            return False


# ═══════════════════════════════════════════════════════════════════════════
# TRIGGER EVENT CACHE
# ═══════════════════════════════════════════════════════════════════════════


class TriggerEventCache:
    """
    Short-lived cache for recent trigger events.

    The admin live dashboard polls for trigger events every 2 minutes.
    Each poll previously ran a full DB scan over manager_disruption_flags
    and policy_claims. This cache stores the 20 most recent events and is
    refreshed atomically when a new trigger fires.

    Keys:
      trigger:events:recent      JSON list  TTL 2 min
      trigger:count:today        integer    TTL until midnight (reset daily)
    """

    MAX_EVENTS: int = 20

    @staticmethod
    def set_recent_events(events: List[Dict]) -> bool:
        try:
            redis_client.setex(
                "trigger:events:recent", CACHE_TTL["admin_triggers"], json.dumps(events)
            )
            logger.debug(f"[CACHE] Cached {len(events)} recent trigger events")
            return True
        except Exception as e:
            logger.debug(f"[CACHE] Failed to cache trigger events: {e}")
            return False

    @staticmethod
    def get_recent_events() -> Optional[List[Dict]]:
        try:
            cached = redis_client.get("trigger:events:recent")
            if cached:
                logger.debug("[CACHE HIT] Recent trigger events")
                return json.loads(cached)
            return None
        except Exception as e:
            logger.debug(f"[CACHE] Failed to get trigger events: {e}")
            return None

    @staticmethod
    def append_event(event: Dict) -> bool:
        """
        Prepend a new trigger event to the cached list.
        Trims to MAX_EVENTS and resets the TTL.
        """
        try:
            existing_raw = redis_client.get("trigger:events:recent")
            events = json.loads(existing_raw) if existing_raw else []
            # Prepend and cap
            events.insert(0, event)
            events = events[: TriggerEventCache.MAX_EVENTS]
            redis_client.setex(
                "trigger:events:recent", CACHE_TTL["admin_triggers"], json.dumps(events)
            )
            logger.debug(
                f"[CACHE] Appended trigger event: zone={event.get('zone_id', '?')}"
            )
            return True
        except Exception as e:
            logger.debug(f"[CACHE] Failed to append trigger event: {e}")
            return False

    @staticmethod
    def increment_today_count() -> int:
        """Increment today's trigger count. Key resets at midnight via TTL."""
        try:
            key = "trigger:count:today"
            count = redis_client.incr(key)
            if count == 1:
                # Seconds remaining until next midnight UTC
                now = datetime.utcnow()
                midnight = (now + timedelta(days=1)).replace(
                    hour=0, minute=0, second=0, microsecond=0
                )
                ttl = int((midnight - now).total_seconds())
                redis_client.expire(key, ttl)
            return int(count)
        except Exception as e:
            logger.debug(f"[CACHE] Failed to increment trigger count: {e}")
            return 0

    @staticmethod
    def get_today_count() -> int:
        """Get today's trigger event count."""
        try:
            val = redis_client.get("trigger:count:today")
            return int(val) if val else 0
        except Exception as e:
            logger.debug(f"[CACHE] Failed to get today trigger count: {e}")
            return 0


# ═══════════════════════════════════════════════════════════════════════════
# PLAN COMPARISON CACHE
# ═══════════════════════════════════════════════════════════════════════════


class PlanComparisonCache:
    """
    Cache for city-tier-adjusted plan comparison data.

    GET /policies/plans/compare is called on every worker onboarding and
    policy management page load. The response is identical for all workers
    in the same city tier — only 3 distinct values (tier1, tier2, tier3).
    Caching eliminates the repeated multiplier + payout computation.

    Key:  plans:compare:{city_tier}    (1, 2, or 3)
    TTL:  1 hour (updated when admin changes city-tier multipliers)
    """

    @staticmethod
    def set(city_tier: int, comparison_data: Dict[str, Any]) -> bool:
        try:
            key = f"plans:compare:{city_tier}"
            redis_client.setex(
                key, CACHE_TTL["plan_comparison"], json.dumps(comparison_data)
            )
            logger.debug(f"[CACHE] Cached plan comparison for tier {city_tier}")
            return True
        except Exception as e:
            logger.debug(f"[CACHE] Failed to cache plan comparison: {e}")
            return False

    @staticmethod
    def get(city_tier: int) -> Optional[Dict[str, Any]]:
        try:
            key = f"plans:compare:{city_tier}"
            cached = redis_client.get(key)
            if cached:
                logger.debug(f"[CACHE HIT] Plan comparison tier {city_tier}")
                return json.loads(cached)
            return None
        except Exception as e:
            logger.debug(f"[CACHE] Failed to get plan comparison: {e}")
            return None

    @staticmethod
    def invalidate_all() -> int:
        """Bust all tier comparisons (call when admin updates multipliers)."""
        try:
            keys = [f"plans:compare:{t}" for t in (1, 2, 3)]
            deleted = redis_client.delete(*keys)
            logger.info(f"[CACHE] Invalidated {deleted} plan comparison keys")
            return deleted
        except Exception as e:
            logger.debug(f"[CACHE] Failed to invalidate plan comparisons: {e}")
            return 0


# ═══════════════════════════════════════════════════════════════════════════
# ACTUARIAL PIPELINE CACHE
# ═══════════════════════════════════════════════════════════════════════════


class ActuarialCache:
    """
    Cache for the full actuarial closed-loop pipeline result.

    compute_actuarial_pipeline() chains:
      income_model → disruption_realtime_model → E[L] formula → premium_model
    That is 3 separate ML inference calls + ~15 DB queries total. The result
    changes only when the worker's latest DailyOperation changes (every ~15 min
    via Celery beat), so a 15-minute TTL matches the data freshness window.

    Key:  actuarial:{worker_id}:{plan_tier_or_auto}
    TTL:  15 minutes (900 s)
    Invalidate on: new DailyOperation insert, plan change, profile update
    """

    @staticmethod
    def set(worker_id: int, plan_tier: str, result: Dict[str, Any]) -> bool:
        try:
            key = f"actuarial:{worker_id}:{plan_tier or 'auto'}"
            redis_client.setex(key, CACHE_TTL["actuarial_pipeline"], json.dumps(result))
            logger.debug(f"[CACHE] Cached actuarial pipeline: worker={worker_id}")
            return True
        except Exception as e:
            logger.debug(f"[CACHE] Failed to cache actuarial pipeline: {e}")
            return False

    @staticmethod
    def get(worker_id: int, plan_tier: str) -> Optional[Dict[str, Any]]:
        try:
            key = f"actuarial:{worker_id}:{plan_tier or 'auto'}"
            cached = redis_client.get(key)
            if cached:
                logger.debug(f"[CACHE HIT] Actuarial pipeline: worker={worker_id}")
                return json.loads(cached)
            return None
        except Exception as e:
            logger.debug(f"[CACHE] Failed to get actuarial pipeline: {e}")
            return None

    @staticmethod
    def invalidate(worker_id: int) -> int:
        """Invalidate all plan tiers for a worker."""
        try:
            pattern = f"actuarial:{worker_id}:*"
            keys = redis_client.keys(pattern)
            deleted = redis_client.delete(*keys) if keys else 0
            if deleted:
                logger.info(
                    f"[CACHE] Invalidated {deleted} actuarial keys for worker {worker_id}"
                )
            return deleted
        except Exception as e:
            logger.debug(f"[CACHE] Failed to invalidate actuarial: {e}")
            return 0


def get_cache_stats() -> Dict[str, Any]:
    """Get cache usage statistics."""
    try:
        info = redis_client.info()
        return {
            "memory_used_mb": round(info.get("used_memory", 0) / (1024 * 1024), 2),
            "memory_peak_mb": round(info.get("used_memory_peak", 0) / (1024 * 1024), 2),
            "connected_clients": info.get("connected_clients", 0),
            "total_commands": info.get("total_commands_processed", 0),
            "evicted_keys": info.get("evicted_keys", 0),
        }
    except Exception as e:
        logger.debug(f"[CACHE] Failed to get cache stats: {e}")
        return {}


def flush_all_cache() -> bool:
    """Flush all cache (use with caution!)."""
    try:
        redis_client.flushdb()
        logger.warning("[CACHE] Flushed all cache!")
        return True
    except Exception as e:
        logger.debug(f"[CACHE] Failed to flush cache: {e}")
        return False


def flush_pattern(pattern: str) -> int:
    """Flush cache keys matching a pattern."""
    try:
        keys = redis_client.keys(pattern)
        if keys:
            deleted = redis_client.delete(*keys)
            logger.info(f"[CACHE] Flushed {deleted} keys matching pattern: {pattern}")
            return deleted
        return 0
    except Exception as e:
        logger.debug(f"[CACHE] Failed to flush pattern {pattern}: {e}")
        return 0
