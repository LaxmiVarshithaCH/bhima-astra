from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List

from app.db.session import get_db
from app.services.admin_service import (
    auto_verify_and_trigger,
    get_all_flags,
    verify_flag,
    reject_flag,
    get_payout_queue
)

from app.schemas.admin import (
    AdminFlagResponse,
    MessageResponse,
    PayoutQueueResponse
)

router = APIRouter(prefix="/api/v1/admin", tags=["Admin"])


# 🔥 1. AUTO VERIFY ENGINE
@router.post("/auto-verify", response_model=MessageResponse)
def auto_verify(db: Session = Depends(get_db)):
    return auto_verify_and_trigger(db)


# 🔍 2. VIEW ALL FLAGS
@router.get("/flags", response_model=List[AdminFlagResponse])
def fetch_all_flags(db: Session = Depends(get_db)):
    return get_all_flags(db)


# ✅ 3. MANUAL VERIFY
@router.post("/verify/{flag_id}", response_model=MessageResponse)
def verify(flag_id: int, db: Session = Depends(get_db)):
    return verify_flag(db, flag_id)


# ❌ 4. MANUAL REJECT
@router.post("/reject/{flag_id}", response_model=MessageResponse)
def reject(flag_id: int, db: Session = Depends(get_db)):
    return reject_flag(db, flag_id)


# 💰 5. VIEW PAYOUT QUEUE
@router.get("/payout-queue", response_model=List[PayoutQueueResponse])
def payout_queue(db: Session = Depends(get_db)):
    return get_payout_queue(db)