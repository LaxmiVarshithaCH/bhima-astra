import random
from datetime import datetime, timedelta

from app.core.security import create_access_token
from app.db.models.otp import OTPToken
from app.db.models.worker import Worker
from app.utils.cache_manager import RateLimitCache
from sqlalchemy.orm import Session


def generate_otp():
    return str(random.randint(100000, 999999))


def send_otp(db: Session, phone_number: str):
    # ── Rate limit: max 5 OTP requests per phone per hour ─────────────────
    rate = RateLimitCache.check_and_increment_otp(phone_number)
    if not rate["allowed"]:
        from fastapi import HTTPException

        raise HTTPException(
            status_code=429,
            detail=f"Too many OTP requests. Try again in {rate['reset_in_seconds']} seconds. "
            f"({rate['count']}/{RateLimitCache.MAX_OTP_PER_HOUR} attempts used)",
        )

    otp = generate_otp()

    otp_entry = OTPToken(
        phone_number=phone_number,
        otp_code=otp,
        expires_at=datetime.utcnow() + timedelta(minutes=5),
        is_used=False,
    )

    db.add(otp_entry)
    db.commit()

    # 🔥 For now, print OTP (later integrate SMS)
    print(f"OTP for {phone_number}: {otp}")

    return otp


def verify_otp(db: Session, phone_number: str, otp: str):
    otp_record = (
        db.query(OTPToken)
        .filter(
            OTPToken.phone_number == phone_number,
            OTPToken.otp_code == otp,
            OTPToken.is_used == False,
        )
        .order_by(OTPToken.created_at.desc())
        .first()
    )

    if not otp_record:
        return None

    if otp_record.expires_at < datetime.utcnow():
        return None

    # mark used
    otp_record.is_used = True
    db.commit()

    # 🔥 Check worker exists
    worker = db.query(Worker).filter(Worker.phone_number == phone_number).first()

    # 🔥 AUTO-ONBOARD (as per your design)
    if not worker:
        worker = Worker(
            phone_number=phone_number,
            worker_name="New Worker",
            platform="Unknown",
            city="Unknown",
        )
        db.add(worker)
        db.commit()
        db.refresh(worker)

    # create token
    token = create_access_token({"worker_id": worker.worker_id, "phone": phone_number, "role": "worker"})
    return {"token": token, "worker_id": worker.worker_id}


from app.core.security import create_access_token
from app.db.models.admin import Admin
from app.db.models.manager import Manager
from app.utils.security import verify_password
from passlib.context import CryptContext


def login_manager(db, email: str, password: str):
    manager = db.query(Manager).filter(Manager.email == email).first()

    if not manager or not verify_password(password, manager.password_hash):
        return None

    return create_access_token({"manager_id": manager.manager_id, "role": "manager"})


def login_admin(db, email: str, password: str):
    admin = db.query(Admin).filter(Admin.email == email).first()

    if not admin or not verify_password(password, admin.password_hash):
        return None

    return create_access_token({"admin_id": admin.admin_id, "role": "admin"})
