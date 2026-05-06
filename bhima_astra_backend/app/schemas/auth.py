from typing import Optional

from pydantic import BaseModel


class OTPSendRequest(BaseModel):
    phone_number: str


class OTPSendResponse(BaseModel):
    message: str
    demo_otp: Optional[str] = None  # returned for hackathon demo only


class OTPVerifyRequest(BaseModel):
    phone_number: str
    otp: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    worker_id: Optional[int] = None


class ManagerLoginRequest(BaseModel):
    email: str
    password: str


class AdminLoginRequest(BaseModel):
    email: str
    password: str
