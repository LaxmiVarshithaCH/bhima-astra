from pydantic import BaseModel
from dotenv import load_dotenv
import os
from typing import Optional

load_dotenv()


class Settings(BaseModel):
    # Database
    DATABASE_URL: Optional[str] = os.getenv(
        "DATABASE_URL",
        "postgresql://localhost/bhima"
    )
    
    # Redis
    REDIS_URL: Optional[str] = os.getenv(
        "REDIS_URL",
        "redis://localhost:6379"
    )
    
    # Security
    SECRET_KEY: str = os.getenv(
        "SECRET_KEY",
        "your-secret-key-change-in-production"
    )
    ALGORITHM: str = os.getenv("ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(
        os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60")
    )
    
    # CORS
    ALLOWED_ORIGINS: list = os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:3000,http://localhost:5173"
    ).split(",")
    
    # Environment
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    DEBUG: bool = os.getenv("ENVIRONMENT", "development") == "development"
    
    class Config:
        case_sensitive = True


settings = Settings()