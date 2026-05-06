"""
Fraud Detection Agent - 4-Stage ML Cascade Integration

This agent runs fraud checks on claims using the trained 4-stage ML cascade:
  Stage 1: Deterministic rules (GPS, accelerometer, response time)
  Stage 2: Behavioral scoring (GPS, motion, interaction, location weights)
  Stage 3: Graph clustering (Louvain community detection)
  Stage 4: Adaptive percentile (combines all signals)

Payout Actions:
  - release_full: Pay 100% of claim
  - release_partial: Pay 50% of claim + store flag
  - hold_48h: Hold decision for 48 hours pending review
  - block_permanent: Block claim permanently
"""

import logging
from datetime import datetime
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.db.models.policy_claim import PolicyClaim
from app.db.models.fraud_flag import FraudFlag  # Stores fraud signals
from app.ml.fraud_inference import run_fraud_check as ml_fraud_check

logger = logging.getLogger("bhima.fraud_agent")


def process_fraud_check(db: Session, claim_id: int) -> dict:
    """
    Run complete fraud detection pipeline on claim.
    
    Args:
        db: Database session
        claim_id: Claim ID to verify
        
    Returns:
        Fraud check result with detailed breakdown:
        {
            'claim_id': int,
            'fraud_score': float (0-1),
            'fraud_flag': bool,
            'payout_action': str (release_full/release_partial/hold_48h/block_permanent),
            'fraud_reason': [str],
            'stage_breakdown': {
                'stage1_score': float,
                'stage2_score': float,
                'stage3_score': float,
                'stage4_score': float,
            },
            'cluster_size': int,
            'processing_time_ms': float,
            'timestamp': datetime,
            'review_required': bool,
        }
    """
    try:
        # Retrieve claim
        claim = db.query(PolicyClaim).filter(PolicyClaim.claim_id == claim_id).first()
        if not claim:
            logger.error(f"[FRAUD] Claim not found: {claim_id}")
            return {
                "claim_id": claim_id,
                "error": "Claim not found",
                "status": "error"
            }
        
        logger.info(f"[FRAUD] Starting 4-stage cascade - claim={claim_id}, worker={claim.worker_id}")
        
        # Run ML fraud pipeline
        fraud_result = ml_fraud_check(db, claim_id)
        
        fraud_score = fraud_result.get("fraud_score", 0.0)
        fraud_flag = fraud_result.get("fraud_flag", False)
        payout_action = fraud_result.get("payout_action", "hold_48h")
        fraud_reason = fraud_result.get("fraud_reason", [])
        
        logger.info(f"[FRAUD] Result - score={fraud_score:.3f}, flag={fraud_flag}, "
                   f"action={payout_action}, reasons={fraud_reason}")
        
        # Store fraud signal in database for audit trail
        if fraud_flag or payout_action == "hold_48h":
            fraud_record = FraudFlag(
                claim_id=claim_id,
                worker_id=claim.worker_id,
                fraud_score=fraud_score,
                fraud_flag=fraud_flag,
                payout_action=payout_action,
                fraud_reason=", ".join(fraud_reason) if fraud_reason else "",
                stage_breakdown=str(fraud_result.get("stage_scores", {})),
                detected_at=datetime.utcnow(),
                review_status="pending_review" if payout_action == "hold_48h" else "auto_processed"
            )
            db.add(fraud_record)
            db.commit()
            logger.info(f"[FRAUD] Recorded fraud signal - claim={claim_id}, record_stored=True")
        
        # Update claim with fraud determination
        claim.fraud_score = fraud_score
        claim.fraud_flag = fraud_flag
        claim.fraud_reason = ", ".join(fraud_reason) if fraud_reason else ""
        
        if payout_action == "release_full":
            claim.payout_status = "approved"
        elif payout_action == "release_partial":
            claim.payout_status = "partial_approved"
        elif payout_action == "hold_48h":
            claim.payout_status = "on_hold_review"
        elif payout_action == "block_permanent":
            claim.payout_status = "blocked"
        
        db.commit()
        logger.info(f"[FRAUD] Claim updated - claim={claim_id}, payout_status={claim.payout_status}")
        
        return {
            "claim_id": claim_id,
            "worker_id": claim.worker_id,
            "fraud_score": fraud_score,
            "fraud_flag": fraud_flag,
            "payout_action": payout_action,
            "fraud_reason": fraud_reason,
            "stage_breakdown": fraud_result.get("stage_scores", {}),
            "cluster_size": fraud_result.get("cluster_size", 0),
            "processing_time_ms": fraud_result.get("processing_time_ms", 0),
            "timestamp": datetime.utcnow().isoformat(),
            "review_required": payout_action == "hold_48h",
            "status": "success"
        }
        
    except Exception as e:
        logger.error(f"[FRAUD] Error processing claim {claim_id}: {str(e)}", exc_info=True)
        return {
            "claim_id": claim_id,
            "error": str(e),
            "status": "error"
        }
