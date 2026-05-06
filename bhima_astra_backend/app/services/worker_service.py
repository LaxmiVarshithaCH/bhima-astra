from sqlalchemy.orm import Session
from app.db.models.worker import Worker
from app.db.models.daily_operations import DailyOperation
from app.db.models.policy_claim import PolicyClaim


def get_worker_profile(db: Session, worker_id: int):
    return db.query(Worker).filter(Worker.worker_id == worker_id).first()


def get_worker_daily_ops(db: Session, worker_id: int):
    return (
        db.query(DailyOperation)
        .filter(DailyOperation.worker_id == worker_id)
        .order_by(DailyOperation.date.desc())
        .limit(10)
        .all()
    )


def get_worker_payouts(db: Session, worker_id: int):
    return (
        db.query(PolicyClaim)
        .filter(PolicyClaim.worker_id == worker_id)
        .order_by(PolicyClaim.claim_timestamp.desc())
        .limit(10)
        .all()
    )


def get_worker_earnings_estimate(db: Session, worker_id: int):
    recent_ops = (
        db.query(DailyOperation)
        .filter(DailyOperation.worker_id == worker_id)
        .order_by(DailyOperation.date.desc())
        .limit(7)
        .all()
    )

    if not recent_ops:
        return {"avg_income": 0}

    avg_income = sum(op.daily_income for op in recent_ops) / len(recent_ops)

    return {"avg_income": avg_income}

def update_worker_profile(db: Session, worker_id: int, data: dict):
    worker = db.query(Worker).filter(Worker.worker_id == worker_id).first()

    if not worker:
        return None

    for key, value in data.items():
        if hasattr(worker, key):
            setattr(worker, key, value)

    db.commit()
    db.refresh(worker)

    return worker