"""Access to a user's library: ``likes`` and ``recently_played``."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from pymongo.database import Database


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class LibraryRepository:
    def __init__(self, db: Database) -> None:
        self._likes = db.likes
        self._recently_played = db.recently_played

    # --- likes ---
    def add_like(self, user_id: str, song_id: str) -> None:
        self._likes.update_one(
            {"user_id": user_id, "song_id": song_id},
            {"$setOnInsert": {"created_at": _now_iso()}},
            upsert=True,
        )

    def remove_like(self, user_id: str, song_id: str) -> None:
        self._likes.delete_one({"user_id": user_id, "song_id": song_id})

    def liked_song_ids(self, user_id: str) -> list[str]:
        return [
            d["song_id"]
            for d in self._likes.find({"user_id": user_id}, {"_id": 0, "song_id": 1})
        ]

    def count_likes(self, user_id: str) -> int:
        return self._likes.count_documents({"user_id": user_id})

    # --- recently played ---
    def add_recent(self, user_id: str, song_id: str) -> None:
        self._recently_played.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "song_id": song_id,
            "played_at": _now_iso(),
        })

    def recent_entries(self, user_id: str, limit: int = 50) -> list[dict[str, Any]]:
        return list(
            self._recently_played.find({"user_id": user_id}, {"_id": 0})
            .sort("played_at", -1)
            .limit(limit)
        )
