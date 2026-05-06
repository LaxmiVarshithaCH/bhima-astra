from app.db.session import get_db
from app.schemas.auth import (
    AdminLoginRequest,
    ManagerLoginRequest,
    OTPSendRequest,
    OTPSendResponse,
    OTPVerifyRequest,
    TokenResponse,
)
from app.services.auth_service import send_otp, verify_otp
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

router = APIRouter(prefix="/api/v1/auth", tags=["Auth"])


@router.post("/worker/otp-send", response_model=OTPSendResponse)
def otp_send(req: OTPSendRequest, db: Session = Depends(get_db)):
    otp = send_otp(db, req.phone_number)
    return OTPSendResponse(
        message="OTP sent successfully",
        demo_otp=otp,  # visible in response for demo purposes
    )


@router.post("/worker/otp-verify", response_model=TokenResponse)
def otp_verify(req: OTPVerifyRequest, db: Session = Depends(get_db)):
    result = verify_otp(db, req.phone_number, req.otp)

    if not result:
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")

    return {
        "access_token": result["token"],
        "token_type": "bearer",
        "worker_id": result["worker_id"],
    }


from app.services.auth_service import login_admin, login_manager


@router.post("/manager/login")
def manager_login(req: ManagerLoginRequest, db: Session = Depends(get_db)):
    token = login_manager(db, req.email, req.password)

    if not token:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    from app.db.models.manager import Manager

    manager = db.query(Manager).filter(Manager.email == req.email).first()
    if not manager:
        raise HTTPException(status_code=404, detail="Manager record not found")
    return {
        "access_token": token,
        "token_type": "bearer",
        "manager_id": manager.manager_id,
        "manager_name": manager.manager_name,
        "assigned_zones": manager.assigned_zones or [],
    }


@router.post("/admin/login")
def admin_login(req: AdminLoginRequest, db: Session = Depends(get_db)):
    token = login_admin(db, req.email, req.password)

    if not token:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    from app.db.models.admin import Admin

    admin = db.query(Admin).filter(Admin.email == req.email).first()
    if not admin:
        raise HTTPException(status_code=404, detail="Admin record not found")

    return {
        "access_token": token,
        "token_type": "bearer",
        "admin_id": admin.admin_id,
        "admin_name": admin.admin_name or "Admin",
    }
