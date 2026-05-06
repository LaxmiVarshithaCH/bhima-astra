from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.services.trigger_service import evaluate_and_trigger

router = APIRouter(prefix="/internal", tags=["Internal"])


@router.post("/trigger/{worker_id}")
def trigger(worker_id: int, db: Session = Depends(get_db)):
    return evaluate_and_trigger(db, worker_id)

from app.services.fraud_service import process_fraud_check
@router.post("/fraud/{claim_id}")
def fraud(claim_id: int, db: Session = Depends(get_db)):
    return process_fraud_check(db, claim_id)

from app.services.payout_service import process_payout
@router.post("/payout/{claim_id}")
def payout(claim_id: int, db: Session = Depends(get_db)):
    return process_payout(db, claim_id)

from app.services.forecast_service import update_forecast

@router.post("/forecast/update")
def run_forecast_update(db: Session = Depends(get_db)):
    return update_forecast(db)