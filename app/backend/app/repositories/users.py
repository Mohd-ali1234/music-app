"""Access to the ``users`` collection."""
from __future__ import annotations

from typing import Any

from pymongo.database import Database

# Never leak the Mongo id or the password hash to callers by default.
_SAFE_PROJECTION = {"_id": 0, "password_hash": 0}


class UserRepository:
    def __init__(self, db: Database) -> None:
        self._users = db.users

    def get_by_id(self, user_id: str) -> dict[str, Any] | None:
        return self._users.find_one({"id": user_id}, _SAFE_PROJECTION)

    def get_by_email_with_hash(self, email: str) -> dict[str, Any] | None:
        """Return the full row (including ``password_hash``) for login checks."""
        return self._users.find_one({"email": email.lower()}, {"_id": 0})

    def email_exists(self, email: str) -> bool:
        return self._users.find_one({"email": email.lower()}, {"_id": 0}) is not None

    def insert(self, doc: dict[str, Any]) -> None:
        self._users.insert_one(doc)

    def music_preferences(self, user_id: str) -> dict[str, list[str]]:
        row = self._users.find_one({"id": user_id}, {"_id": 0, "music_preferences": 1}) or {}
        return row.get("music_preferences") or {}
