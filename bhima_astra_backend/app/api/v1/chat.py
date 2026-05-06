"""
Chat API — /chat
================
Claude Haiku-powered policy chatbot for BHIMA ASTRA worker portal.
"""

import logging
import os

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

logger = logging.getLogger("bhima.api.chat")

router = APIRouter(prefix="/chat", tags=["Chat"])


class ChatRequest(BaseModel):
    query: str
    worker_context: dict | None = None  # optional worker profile context


class ChatResponse(BaseModel):
    response: str
    model: str = "claude-haiku"


SYSTEM_PROMPT = """You are BHIMA ASTRA's helpful policy assistant for gig delivery workers in India.
You help workers understand their parametric insurance policy, explain payouts, triggers, and coverage.

Key facts about BHIMA ASTRA:
- Parametric insurance: payouts trigger automatically when weather thresholds are crossed
- Triggers: Heavy Rainfall (≥64.5mm L1, ≥115.6mm L2, ≥204.5mm L3), Extreme Heat (≥40°C L1, ≥45°C L2), AQI Spike (≥300 L1, ≥400 L2), Flood, Civil Disruption
- Plans: Basic (₹49/week, ₹300 L1 payout), Standard (₹79/week, ₹400 L1), Premium (₹119/week, ₹600 L1)
- Max 2 events per week policy period
- Payouts via UPI within 2 hours of trigger
- No claims process needed - fully automatic
- KYC must be verified for payouts
- City multipliers: Tier-1 cities (Mumbai, Delhi, Bangalore) get 1.2x payouts

Keep answers concise (2-3 sentences max), friendly, and in simple English.
If asked about Hindi or Telugu, respond in that language.
Never make up specific policy numbers or personal worker data unless provided in context."""


@router.post("", response_model=ChatResponse)
async def chat(req: ChatRequest):
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="Chat service not configured")

    try:
        import anthropic

        client = anthropic.Anthropic(api_key=api_key)

        # Build user message with optional worker context
        user_message = req.query
        if req.worker_context:
            ctx_parts = []
            if req.worker_context.get("worker_name"):
                ctx_parts.append(f"Worker: {req.worker_context['worker_name']}")
            if req.worker_context.get("plan_tier"):
                ctx_parts.append(f"Plan: {req.worker_context['plan_tier']}")
            if req.worker_context.get("city"):
                ctx_parts.append(f"City: {req.worker_context['city']}")
            if req.worker_context.get("geo_zone_id"):
                ctx_parts.append(f"Zone: {req.worker_context['geo_zone_id']}")
            if ctx_parts:
                user_message = (
                    f"[Worker context: {', '.join(ctx_parts)}]\n\n{req.query}"
                )

        message = client.messages.create(
            model="claude-haiku-20240307",
            max_tokens=512,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_message}],
        )

        response_text = (
            message.content[0].text
            if message.content
            else "I'm unable to respond right now."
        )
        return ChatResponse(response=response_text)

    except ImportError:
        raise HTTPException(status_code=503, detail="anthropic package not installed")
    except Exception as e:
        # Expected transient errors (credits, rate-limit, network) — log at WARNING
        # without a full traceback so the server logs stay readable.
        err_str = str(e)
        if any(
            k in err_str.lower()
            for k in ("credit", "rate_limit", "overloaded", "connection")
        ):
            logger.warning(f"[CHAT] Claude API unavailable (expected): {err_str[:120]}")
        else:
            logger.error(f"[CHAT] Claude API error: {e}", exc_info=True)
        # Graceful fallback response
        return ChatResponse(
            response="I'm having trouble connecting right now. For policy questions, check the Plans tab or contact support.",
            model="fallback",
        )
