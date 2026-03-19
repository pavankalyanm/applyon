from __future__ import annotations

import hashlib
import os
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from . import db, models


def _to_digest(password: str) -> bytes:
    """Pre-hash with SHA-256 so bcrypt never sees > 72 bytes."""
    return hashlib.sha256(password.encode("utf-8")).digest()


def hash_password(password: str) -> str:
    digest = _to_digest(password)
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(digest, salt)
    return hashed.decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    digest = _to_digest(password)
    return bcrypt.checkpw(digest, password_hash.encode("utf-8"))


security = HTTPBearer(auto_error=True)


def _jwt_secret() -> str:
    secret = os.getenv("JWT_SECRET")
    if not secret:
        raise RuntimeError("JWT_SECRET not set")
    return secret


def _jwt_alg() -> str:
    return os.getenv("JWT_ALG", "HS256")


def create_access_token(*, user_id: int, email: str, expires_minutes: int | None = None) -> str:
    minutes = expires_minutes or int(os.getenv("JWT_EXPIRES_MIN", "10080"))  # default 7 days
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "email": email,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=minutes)).timestamp()),
    }
    return jwt.encode(payload, _jwt_secret(), algorithm=_jwt_alg())


def get_current_user_from_token(token: str, session: Session) -> models.User:
    try:
        payload = jwt.decode(token, _jwt_secret(), algorithms=[_jwt_alg()])
        user_id = int(payload.get("sub"))
    except (JWTError, TypeError, ValueError) as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from exc

    user = session.query(models.User).filter(models.User.id == user_id).one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    session: Session = Depends(db.get_session),
) -> models.User:
    return get_current_user_from_token(credentials.credentials, session)
