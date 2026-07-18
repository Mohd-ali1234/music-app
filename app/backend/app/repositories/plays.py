"""Access to the raw ``plays`` collection (global play events)."""
from __future__ import annotations

from typing import Iterable

from pymongo.database import Database


class PlaysRepository:
    def __init__(self, db: Database) -> None:
        self._plays = db.plays

    def count_for_user(self, user_id: str) -> int:
        return self._plays.count_documents({"user_id": user_id})

    def play_counts_by_song(self, song_ids: Iterable[str]) -> dict[str, int]:
        """Return ``{song_id: play_count}`` for the given songs in one query."""
        ids = list(song_ids)
        if not ids:
            return {}
        cursor = self._plays.aggregate([
            {"$match": {"song_id": {"$in": ids}}},
            {"$group": {"_id": "$song_id", "n": {"$sum": 1}}},
        ])
        return {row["_id"]: row["n"] for row in cursor}
