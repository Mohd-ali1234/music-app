
# Action: file_editor create /app/backend/auth.py --file-text """"JWT auth (HS256, 30d tokens) + bcrypt password hashing."""
import os
import uuid
import bcrypt
import jwt
from datetime import datetime, timedelta, timezone
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from db import get_db

_JWT_ALGO = "HS256"
_TOKEN_DAYS = 30


def _jwt_secret() -> str:
    secret = os.environ.get("JWT_SECRET", "").strip()
    env = os.environ.get("APP_ENV", "development").lower()
    if not secret:
        if env == "production":
            raise RuntimeError("JWT_SECRET must be set in production")
        return "dev-insecure-secret-do-not-use-in-prod"
    return secret


def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def make_token(user_id: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(days=_TOKEN_DAYS)).timestamp()),
    }
    return jwt.encode(payload, _jwt_secret(), algorithm=_JWT_ALGO)


def decode_token(token: str) -> dict:
    return jwt.decode(token, _jwt_secret(), algorithms=[_JWT_ALGO])


_bearer = HTTPBearer(auto_error=False)


def current_user(cred: HTTPAuthorizationCredentials | None = Depends(_bearer)) -> dict:
    if cred is None or not cred.credentials:
        raise HTTPException(status_code=401, detail="Missing bearer token")
    try:
        payload = decode_token(cred.credentials)
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = get_db().users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def create_user(email: str, password: str, display_name: str | None = None) -> dict:
    db = get_db()
    if db.users.find_one({"email": email.lower()}, {"_id": 0}):
        raise HTTPException(status_code=409, detail="Email already registered")
    doc = {
        "id": str(uuid.uuid4()),
        "email": email.lower(),
        "display_name": display_name or email.split("@")[0],
        "password_hash": hash_password(password),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    db.users.insert_one(doc)
    return {k: v for k, v in doc.items() if k not in ("_id", "password_hash")}
# "
# Observation: Create successful: /app/backend/auth.py