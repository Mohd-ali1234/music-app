"""Per-user play statistics: song / artist / album aggregates.

These counters power personalization (recommendation signals), the profile
screen, and the home feed. Writes are simple idempotent upserts; reads are
served straight from the pre-aggregated collections (no fan-out scans).
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from pymongo.database import Database


class UserStatsRepository:
    def __init__(self, db: Database) -> None:
        self._song_stats = db.user_song_stats
        self._artist_stats = db.user_artist_stats
        self._album_stats = db.user_album_stats

    # --- writes (invoked when a play is recorded) ---
    def increment_song_play(self, user_id: str, song_id: str) -> None:
        self._song_stats.update_one(
            {"user_id": user_id, "song_id": song_id},
            {
                "$inc": {"play_count": 1},
                "$set": {"last_played_at": datetime.now(timezone.utc).isoformat()},
            },
            upsert=True,
        )

    def increment_artist_play(self, user_id: str, artist_norm: str) -> None:
        self._artist_stats.update_one(
            {"user_id": user_id, "artist_norm": artist_norm},
            {"$inc": {"play_count": 1}},
            upsert=True,
        )

    def increment_album_play(self, user_id: str, album_norm: str) -> None:
        self._album_stats.update_one(
            {"user_id": user_id, "album_norm": album_norm},
            {"$inc": {"play_count": 1}},
            upsert=True,
        )

    # --- reads: profile / home feed ---
    def top_artists(self, user_id: str, limit: int = 10) -> list[dict[str, Any]]:
        return list(
            self._artist_stats.find({"user_id": user_id}, {"_id": 0})
            .sort("play_count", -1)
            .limit(limit)
        )

    def top_songs(self, user_id: str, limit: int = 10) -> list[dict[str, Any]]:
        return list(
            self._song_stats.find({"user_id": user_id}, {"_id": 0})
            .sort("play_count", -1)
            .limit(limit)
        )

    # --- reads: personalization signal maps ---
    def artist_play_map(self, user_id: str) -> dict[str, int]:
        return {
            d["artist_norm"]: d.get("play_count", 0)
            for d in self._artist_stats.find({"user_id": user_id}, {"_id": 0})
            if d.get("artist_norm")
        }

    def album_play_map(self, user_id: str) -> dict[str, int]:
        return {
            d["album_norm"]: d.get("play_count", 0)
            for d in self._album_stats.find({"user_id": user_id}, {"_id": 0})
            if d.get("album_norm")
        }

    def song_play_map(self, user_id: str) -> dict[str, int]:
        return {
            d["song_id"]: d.get("play_count", 0)
            for d in self._song_stats.find({"user_id": user_id}, {"_id": 0})
            if d.get("song_id")
        }
