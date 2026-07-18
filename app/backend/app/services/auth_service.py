"""Authentication use-cases: registration and login.

HTTP status semantics are preserved exactly (409 on duplicate email, 401 on
bad credentials) so existing clients see identical error responses.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException

from app.core.security import (
    create_access_token,
    hash_password,
    verify_password,
)
from app.repositories import UserRepository


class AuthService:
    def __init__(self, users: UserRepository) -> None:
        self._users = users

    def register(
        self, email: str, password: str, display_name: str | None
    ) -> dict[str, Any]:
        if self._users.email_exists(email):
            raise HTTPException(status_code=409, detail="Email already registered")
        doc = {
            "id": str(uuid.uuid4()),
            "email": email.lower(),
            "display_name": display_name or email.split("@")[0],
            "password_hash": hash_password(password),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        self._users.insert(doc)
        user = {k: v for k, v in doc.items() if k not in ("_id", "password_hash")}
        return {"token": create_access_token(user["id"]), "user": user}

    def login(self, email: str, password: str) -> dict[str, Any]:
        row = self._users.get_by_email_with_hash(email)
        if not row or not verify_password(password, row.get("password_hash", "")):
            raise HTTPException(status_code=401, detail="Invalid credentials")
        user = {k: v for k, v in row.items() if k != "password_hash"}
        return {"token": create_access_token(row["id"]), "user": user}
