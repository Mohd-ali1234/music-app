"""Low-level security primitives: password hashing and JWT encode/decode.

Pure functions with no knowledge of the web layer or the database, so they are
trivial to unit test. HTTP concerns (extracting the bearer token, raising 401s)
live in :mod:`app.api.deps`.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from app.core.config import get_settings


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_access_token(user_id: str) -> str:
    settings = get_settings()
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(days=settings.jwt_token_days)).timestamp()),
    }
    return jwt.encode(
        payload, settings.effective_jwt_secret, algorithm=settings.jwt_algorithm
    )


def decode_access_token(token: str) -> dict:
    settings = get_settings()
    return jwt.decode(
        token, settings.effective_jwt_secret, algorithms=[settings.jwt_algorithm]
    )
