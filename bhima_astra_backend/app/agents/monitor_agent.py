"""
Monitor Agent - Income & Risk Surveillance

This agent runs periodic monitoring tasks:

1. Income Monitoring:
   - Uses Random Forest model to predict expected income
   - Detects anomalies (income drops >20% from baseline)
   - Triggers alerts for at-risk workers

2. Risk Alerts:
   - Monitors zone-level disruption risks
   - Alerts worker if risk > 0.6 (60%)
   - Suggests plan upgrades based on risk tier

3. Policy Health Check:
   - Verifies active policies exist
   - Checks event remaining counts
   - Warns on expiring policies

Typically runs every 5 minutes via Celery Beat.
"""

import logging
from datetime import datetime, timedelta

from app.db.models.daily_operations import DailyOperation
from app.db.models.policy_claim import PolicyClaim
from app.db.models.worker import Worker
from app.db.session import SessionLocal
from app.ml.income_inference import predict_income
from app.ml.risk_inference import compute_risk_score
from sqlalchemy.orm import Session

logger = logging.getLogger("bhima.monitor_agent")


def check_worker_income(db: Session, worker_id: int) -> dict:
    """
    Check worker income using ML prediction model.

    Returns:
        {
            'worker_id': int,
            'expected_income': float,
            'income_baseline_weekly': float,
            'status': 'healthy' | 'anomaly_detected' | 'error',
            'anomaly_type': str (if status == 'anomaly_detected'),
            'recommendation': str,
        }
    """
    try:
        income_pred = predict_income(db, worker_id)
        expected_daily = income_pred.get("expected_income", 0)
        baseline_weekly = income_pred.get("income_baseline_weekly", 0)

        # Get last 7 days actual income
        last_week = datetime.utcnow() - timedelta(days=7)
        recent_ops = (
            db.query(DailyOperation)
            .filter(
                DailyOperation.worker_id == worker_id, DailyOperation.date >= last_week
            )
            .all()
        )
        actual_weekly = sum(op.income_earned or 0 for op in recent_ops)

        # Detect anomalies
        status = "healthy"
        anomaly_type = None
        recommendation = "Continue monitoring"

        if baseline_weekly > 0:
            income_drop_pct = (
                (baseline_weekly - actual_weekly) / baseline_weekly
            ) * 100

            if income_drop_pct > 20:
                status = "anomaly_detected"
                anomaly_type = f"Income drop {income_drop_pct:.1f}%"
                recommendation = "Alert: Consider policy upgrade or income support"
            elif income_drop_pct > 10:
                status = "warning"
                anomaly_type = f"Income decline {income_drop_pct:.1f}%"
                recommendation = "Monitor closely for further decline"

        logger.info(
            f"[MONITOR] Income check - worker={worker_id}, "
            f"expected={expected_daily:.2f}, baseline_weekly={baseline_weekly:.2f}, "
            f"actual_weekly={actual_weekly:.2f}, status={status}"
        )

        return {
            "worker_id": worker_id,
            "expected_income_daily": expected_daily,
            "income_baseline_weekly": baseline_weekly,
            "actual_income_weekly": actual_weekly,
            "status": status,
            "anomaly_type": anomaly_type,
            "recommendation": recommendation,
            "timestamp": datetime.utcnow().isoformat(),
        }

    except Exception as e:
        logger.error(f"[MONITOR] Income check failed for worker {worker_id}: {str(e)}")
        return {"worker_id": worker_id, "status": "error", "error": str(e)}


def check_worker_risk(db: Session, worker_id: int) -> dict:
    """
    Check worker risk level using ML risk model.

    Returns:
        {
            'worker_id': int,
            'zone_risk_score': float,
            'fraud_risk_score': float,
            'disruption_probability': float,
            'city_tier': int,
            'risk_level': 'low' | 'medium' | 'high' | 'critical',
            'recommendation': str,
        }
    """
    try:
        risk_result = compute_risk_score(db, worker_id)

        zone_risk = risk_result.get("zone_risk_score", 0)
        fraud_risk = risk_result.get("fraud_risk_score", 0)
        disruption_prob = risk_result.get("combined_disruption_probability", 0)
        city_tier = risk_result.get("city_tier", 2)

        # Classify risk level
        combined_score = zone_risk * 0.5 + disruption_prob * 0.5

        if combined_score >= 0.75:
            risk_level = "critical"
            recommendation = "⚠️ CRITICAL: Recommend policy review + premium adjustment"
        elif combined_score >= 0.6:
            risk_level = "high"
            recommendation = "⚠️ HIGH: Consider upgrading to premium plan"
        elif combined_score >= 0.4:
            risk_level = "medium"
            recommendation = "Monitor events per month; current plan adequate"
        else:
            risk_level = "low"
            recommendation = "Safe: Continue with current plan"

        logger.info(
            f"[MONITOR] Risk check - worker={worker_id}, "
            f"zone_risk={zone_risk:.3f}, fraud_risk={fraud_risk:.3f}, "
            f"disruption={disruption_prob:.3f}, risk_level={risk_level}"
        )

        return {
            "worker_id": worker_id,
            "zone_risk_score": zone_risk,
            "fraud_risk_score": fraud_risk,
            "disruption_probability": disruption_prob,
            "city_tier": city_tier,
            "risk_level": risk_level,
            "recommendation": recommendation,
            "timestamp": datetime.utcnow().isoformat(),
        }

    except Exception as e:
        logger.error(f"[MONITOR] Risk check failed for worker {worker_id}: {str(e)}")
        return {"worker_id": worker_id, "status": "error", "error": str(e)}


def check_policy_health(db: Session, worker_id: int) -> dict:
    """
    Check policy status and remaining events.

    Returns:
        {
            'worker_id': int,
            'policy_status': 'active' | 'inactive' | 'missing',
            'events_remaining': int,
            'events_used': int,
            'days_until_expiry': int,
            'health_status': 'healthy' | 'warning' | 'critical',
            'recommendation': str,
        }
    """
    try:
        policy = (
            db.query(PolicyClaim)
            .filter(
                PolicyClaim.worker_id == worker_id,
                PolicyClaim.policy_status == "active",
            )
            .order_by(PolicyClaim.activation_date.desc())
            .first()
        )

        if not policy:
            return {
                "worker_id": worker_id,
                "policy_status": "missing",
                "health_status": "critical",
                "recommendation": "URGENT: No active policy found. Worker needs immediate enrollment.",
                "timestamp": datetime.utcnow().isoformat(),
            }

        events_remaining = policy.events_remaining or 0
        events_used = policy.events_used or 0
        total_events = events_used + events_remaining
        events_pct_used = (events_used / total_events * 100) if total_events > 0 else 0

        # Estimate expiration
        activation = policy.activation_date
        estimated_expiry = activation + timedelta(days=365)
        days_until_expiry = (estimated_expiry - datetime.utcnow()).days

        # Determine health
        if events_remaining <= 0:
            health_status = "critical"
            recommendation = (
                "CRITICAL: No events remaining. Worker needs policy renewal."
            )
        elif events_remaining <= 2:
            health_status = "warning"
            recommendation = (
                f"WARNING: Only {events_remaining} events left. Schedule renewal soon."
            )
        elif events_pct_used > 75:
            health_status = "warning"
            recommendation = (
                f"WARNING: 75%+ of events used ({events_used}/{total_events})"
            )
        elif days_until_expiry <= 7:
            health_status = "warning"
            recommendation = f"WARNING: Policy expires in {days_until_expiry} days"
        else:
            health_status = "healthy"
            recommendation = f"Healthy: {events_remaining} events remaining, {days_until_expiry} days until expiry"

        logger.info(
            f"[MONITOR] Policy health - worker={worker_id}, "
            f"events_used={events_used}, remaining={events_remaining}, "
            f"health={health_status}"
        )

        return {
            "worker_id": worker_id,
            "policy_status": "active",
            "plan_tier": policy.plan_tier,
            "events_remaining": events_remaining,
            "events_used": events_used,
            "events_total": total_events,
            "events_pct_used": events_pct_used,
            "days_until_expiry": days_until_expiry,
            "health_status": health_status,
            "recommendation": recommendation,
            "timestamp": datetime.utcnow().isoformat(),
        }

    except Exception as e:
        logger.error(
            f"[MONITOR] Policy health check failed for worker {worker_id}: {str(e)}"
        )
        return {"worker_id": worker_id, "status": "error", "error": str(e)}


def perform_full_worker_monitoring(db: Session, worker_id: int) -> dict:
    """
    Perform complete health check across income, risk, and policy dimensions.

    Returns:
        {
            'worker_id': int,
            'overall_health': 'healthy' | 'warning' | 'critical',
            'income_check': dict,
            'risk_check': dict,
            'policy_check': dict,
            'alerts': [str],
            'timestamp': datetime,
        }
    """
    logger.info(f"[MONITOR] Starting full worker monitoring - worker={worker_id}")

    income_check = check_worker_income(db, worker_id)
    risk_check = check_worker_risk(db, worker_id)
    policy_check = check_policy_health(db, worker_id)

    # Collect alerts
    alerts = []
    if income_check.get("status") == "anomaly_detected":
        alerts.append(f"Income: {income_check.get('anomaly_type')}")
    if risk_check.get("risk_level") in ["high", "critical"]:
        alerts.append(f"Risk: {risk_check.get('risk_level')} level")
    if policy_check.get("health_status") in ["warning", "critical"]:
        alerts.append(f"Policy: {policy_check.get('health_status')} status")

    # Determine overall health
    health_scores = {
        "income": 0 if income_check.get("status") == "anomaly_detected" else 1,
        "risk": 1 - risk_check.get("risk_level" == "critical"),
        "policy": 0
        if policy_check.get("health_status") == "critical"
        else (0.5 if policy_check.get("health_status") == "warning" else 1),
    }
    avg_health = sum(health_scores.values()) / len(health_scores)

    if avg_health < 0.5:
        overall_health = "critical"
    elif avg_health < 0.75:
        overall_health = "warning"
    else:
        overall_health = "healthy"

    logger.info(
        f"[MONITOR] Full check complete - worker={worker_id}, "
        f"overall_health={overall_health}, alerts={len(alerts)}"
    )

    return {
        "worker_id": worker_id,
        "overall_health": overall_health,
        "income_check": income_check,
        "risk_check": risk_check,
        "policy_check": policy_check,
        "alerts": alerts,
        "timestamp": datetime.utcnow().isoformat(),
    }
