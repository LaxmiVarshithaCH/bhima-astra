from typing import Optional

from app.core.security import verify_token
from app.db.models.worker import Worker
from app.db.session import get_db
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

security = HTTPBearer()
security_optional = HTTPBearer(auto_error=False)


def get_current_worker(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    token = credentials.credentials
    payload = verify_token(token)

    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")

    worker_id = payload.get("worker_id")

    worker = db.query(Worker).filter(Worker.worker_id == worker_id).first()

    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")

    return worker


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    """
    Generic auth dependency that accepts any valid JWT role
    (worker / manager / admin).

    Returns a lightweight namespace object with:
        .worker_id  – set for role=worker, None otherwise
        .role       – "worker" | "manager" | "admin"
        .user_id    – primary key of the authenticated entity
    """
    token = credentials.credentials
    payload = verify_token(token)

    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    from types import SimpleNamespace

    role = payload.get("role", "worker")
    worker_id = payload.get("worker_id")
    manager_id = payload.get("manager_id")
    admin_id = payload.get("admin_id")

    user_id = worker_id or manager_id or admin_id

    if user_id is None:
        raise HTTPException(status_code=401, detail="Token contains no user identity")

    return SimpleNamespace(
        worker_id=worker_id,
        manager_id=manager_id,
        admin_id=admin_id,
        user_id=user_id,
        role=role,
        payload=payload,
    )


def get_optional_user(
    credentials: HTTPAuthorizationCredentials = Depends(security_optional),
    db: Session = Depends(get_db),
):
    """
    Optional auth dependency — returns None if no token is provided,
    a user namespace if a valid token is present.
    Useful for public endpoints that show richer data to authenticated users.
    """
    if credentials is None:
        return None

    try:
        from types import SimpleNamespace

        token = credentials.credentials
        payload = verify_token(token)
        if not payload:
            return None

        role = payload.get("role", "worker")
        worker_id = payload.get("worker_id")
        manager_id = payload.get("manager_id")
        admin_id = payload.get("admin_id")
        user_id = worker_id or manager_id or admin_id

        if user_id is None:
            return None

        return SimpleNamespace(
            worker_id=worker_id,
            manager_id=manager_id,
            admin_id=admin_id,
            user_id=user_id,
            role=role,
            payload=payload,
        )
    except Exception:
        return None
