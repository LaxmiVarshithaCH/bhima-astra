"""
Insight Agent - Premium Estimation & Personalization

This agent provides ML-driven insights for policy recommendations:

1. Premium Calculation:
   - Uses Ridge Regression model with actuarial formula
   - Applies city-tier multipliers (1.2x/1.0x/0.85x)
   - Calculates accurate premium based on worker risk profile

2. Coverage Recommendations:
   - Evaluates worker income stability + risk profile
   - Recommends optimal plan tier (basic/standard/premium)
   - Estimates claim frequency based on zone + behavior

3. Personalization:
   - Generates personalized policy recommendations
   - Explains premium drivers and cost optimization opportunities
   - Tracks premium evolution over time

Typically called during worker onboarding and annual renewals.
"""

import logging
from datetime import datetime
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.db.models.worker import Worker
from app.db.models.policy_claim import PolicyClaim
from app.ml.premium_inference import calculate_premium
from app.ml.risk_inference import compute_risk_score
from app.ml.income_inference import predict_income

logger = logging.getLogger("bhima.insight_agent")


def generate_premium_insights(db: Session, worker_id: int) -> dict:
    """
    Generate comprehensive premium insights for a worker.
    
    Returns:
        {
            'worker_id': int,
            'risk_profile': dict,
            'income_profile': dict,
            'premium_recommendations': [dict],
            'optimal_plan': str,
            'insights': [str],
            'timestamp': datetime,
        }
    """
    try:
        logger.info(f"[INSIGHT] Generating premium insights for worker={worker_id}")
        
        # Get risk profile
        risk_data = compute_risk_score(db, worker_id)
        zone_risk = risk_data.get("zone_risk_score", 0)
        disruption_prob = risk_data.get("combined_disruption_probability", 0)
        recommended_plan = risk_data.get("recommended_plan", "standard")
        city_tier = risk_data.get("city_tier", 2)
        
        # Get income profile
        income_data = predict_income(db, worker_id)
        expected_daily_income = income_data.get("expected_income", 0)
        income_baseline_weekly = income_data.get("income_baseline_weekly", 0)
        
        # Calculate premiums for each tier
        premium_options = []
        for plan_tier in ["basic", "standard", "premium"]:
            try:
                premium_calc = calculate_premium(db, worker_id, plan_tier)
                
                final_premium = premium_calc.get("final_premium", 0)
                expected_loss = premium_calc.get("expected_loss", 0)
                city_multiplier = premium_calc.get("city_multiplier", 1.0)
                
                # Calculate loss ratio (claim frequency approximation)
                loss_ratio = (expected_loss * 365) / income_baseline_weekly if income_baseline_weekly > 0 else 0
                
                # Estimate annual cost
                annual_premium = final_premium * 52  # Weekly * 52 weeks
                breakeven_years = annual_premium / expected_loss if expected_loss > 0 else float('inf')
                
                premium_options.append({
                    "plan_tier": plan_tier,
                    "weekly_premium": final_premium,
                    "annual_premium": annual_premium,
                    "expected_loss_weekly": expected_loss,
                    "expected_loss_annual": expected_loss * 52,
                    "loss_ratio_pct": loss_ratio * 100,
                    "breakeven_years": min(breakeven_years, 10),  # Cap at 10 years
                    "city_multiplier_applied": city_multiplier,
                })
                
            except Exception as e:
                logger.warning(f"[INSIGHT] Could not calculate premium for {plan_tier}: {e}")
                continue
        
        # Determine optimal plan
        optimal_plan = recommended_plan
        if disruption_prob > 0.7:
            optimal_plan = "premium"
        elif disruption_prob > 0.5:
            optimal_plan = "standard"
        else:
            optimal_plan = "basic"
        
        # Generate insights
        insights = []
        
        if zone_risk > 0.6:
            insights.append(f"⚠️ High zone risk ({zone_risk:.1%}): Weather & traffic hazards elevated in your area")
        
        if disruption_prob > 0.6:
            insights.append(f"📊 High disruption probability ({disruption_prob:.1%}): Claims likely ~1 per {1/disruption_prob:.0f} weeks")
        
        if income_baseline_weekly > 0:
            premium_pct = premium_options[1]['weekly_premium'] / income_baseline_weekly * 100 if len(premium_options) > 1 else 0
            if premium_pct > 5:
                insights.append(f"💰 Premium consumes {premium_pct:.1f}% of weekly income - consider basic plan")
            elif premium_pct < 2:
                insights.append(f"💰 Premium is affordable ({premium_pct:.1f}% of income) - premium plan covers more")
        
        if city_tier == 1:
            insights.append("🏙️ Tier-1 city: Higher costs due to urban traffic complexity & congestion")
        elif city_tier == 3:
            insights.append("🌳 Tier-3 city: Lower costs - less traffic but higher weather variability")
        
        # Recommendation summary
        if len(premium_options) > 0:
            basic = premium_options[0]
            standard = premium_options[1] if len(premium_options) > 1 else basic
            premium = premium_options[2] if len(premium_options) > 2 else standard
            
            insights.append(f"✅ RECOMMENDATION: {optimal_plan.upper()} plan @ ₹{standard['weekly_premium']:.0f}/week")
        
        logger.info(f"[INSIGHT] Insights generated - worker={worker_id}, "
                   f"optimal_plan={optimal_plan}, premiums_calculated={len(premium_options)}")
        
        return {
            "worker_id": worker_id,
            "risk_profile": {
                "zone_risk_score": zone_risk,
                "disruption_probability": disruption_prob,
                "city_tier": city_tier,
            },
            "income_profile": {
                "expected_daily_income": expected_daily_income,
                "income_baseline_weekly": income_baseline_weekly,
                "projected_annual_income": income_baseline_weekly * 52,
            },
            "premium_recommendations": premium_options,
            "optimal_plan": optimal_plan,
            "insights": insights,
            "timestamp": datetime.utcnow().isoformat(),
        }
        
    except Exception as e:
        logger.error(f"[INSIGHT] Error generating insights for worker {worker_id}: {str(e)}", exc_info=True)
        return {
            "worker_id": worker_id,
            "error": str(e),
            "status": "error"
        }


def generate_renewal_recommendations(db: Session, worker_id: int) -> dict:
    """
    Generate policy renewal recommendations based on updated ML scores.
    
    Evaluates whether worker should:
    - Renew with same plan tier
    - Upgrade to higher tier (risk increased)
    - Downgrade to lower tier (risk decreased)
    - Increase/decrease coverage
    
    Returns:
        {
            'worker_id': int,
            'current_policy': dict,
            'renewal_recommendation': dict,
            'price_change_estimate': dict,
            'justification': [str],
            'timestamp': datetime,
        }
    """
    try:
        logger.info(f"[INSIGHT] Generating renewal recommendations for worker={worker_id}")
        
        # Get current policy
        current_policy = (
            db.query(PolicyClaim)
            .filter(
                PolicyClaim.worker_id == worker_id,
                PolicyClaim.policy_status == "active"
            )
            .order_by(PolicyClaim.activation_date.desc())
            .first()
        )
        
        if not current_policy:
            return {
                "worker_id": worker_id,
                "status": "no_active_policy",
                "error": "No active policy to renew"
            }
        
        current_plan = current_policy.plan_tier
        current_premium = current_policy.weekly_premium
        
        # Get updated risk scores
        risk_data = compute_risk_score(db, worker_id)
        disruption_prob = risk_data.get("combined_disruption_probability", 0)
        
        # Calculate new premium
        new_premium_calc = calculate_premium(db, worker_id, current_plan)
        new_premium = new_premium_calc.get("final_premium", current_premium)
        price_change = new_premium - current_premium
        price_change_pct = (price_change / current_premium * 100) if current_premium > 0 else 0
        
        # Recommend plan adjustment
        plan_recommendation = current_plan
        if disruption_prob > 0.7 and current_plan != "premium":
            plan_recommendation = "premium"
            reason = "Disruption risk significantly increased - upgrade for better coverage"
        elif disruption_prob < 0.3 and current_plan == "premium":
            plan_recommendation = "standard"
            reason = "Disruption risk has decreased - downgrade to reduce costs"
        elif disruption_prob < 0.2 and current_plan in ["premium", "standard"]:
            plan_recommendation = "basic"
            reason = "Minimal disruption risk - basic plan sufficient"
        else:
            reason = "Current plan tier remains optimal for risk profile"
        
        # Calculate projected savings/costs
        if plan_recommendation != current_plan:
            recommended_premium_calc = calculate_premium(db, worker_id, plan_recommendation)
            recommended_premium = recommended_premium_calc.get("final_premium", current_premium)
            annual_difference = (recommended_premium - current_premium) * 52
        else:
            recommended_premium = new_premium
            annual_difference = price_change * 52
        
        justification = [
            reason,
            f"Disruption probability: {disruption_prob:.1%}",
            f"Current plan: {current_plan} @ ₹{current_premium:.0f}/week",
            f"Premium change estimate: ₹{new_premium:.0f}/week ({price_change_pct:+.1f}%)",
            f"Annual impact: ₹{annual_difference:+.0f}",
        ]
        
        logger.info(f"[INSIGHT] Renewal recommendation generated - worker={worker_id}, "
                   f"current_plan={current_plan}, recommended_plan={plan_recommendation}, "
                   f"price_change={price_change_pct:+.1f}%")
        
        return {
            "worker_id": worker_id,
            "current_policy": {
                "plan_tier": current_plan,
                "weekly_premium": current_premium,
                "annual_premium": current_premium * 52,
                "activation_date": current_policy.activation_date.isoformat(),
            },
            "renewal_recommendation": {
                "recommended_plan": plan_recommendation,
                "reason": reason,
                "new_weekly_premium": new_premium,
                "new_annual_premium": new_premium * 52,
            },
            "price_change_estimate": {
                "weekly_change": price_change,
                "weekly_change_pct": price_change_pct,
                "annual_change": price_change * 52,
                "annual_change_pct": price_change_pct,
            },
            "justification": justification,
            "timestamp": datetime.utcnow().isoformat(),
        }
        
    except Exception as e:
        logger.error(f"[INSIGHT] Error generating renewal recommendation for worker {worker_id}: {str(e)}", exc_info=True)
        return {
            "worker_id": worker_id,
            "error": str(e),
            "status": "error"
        }
