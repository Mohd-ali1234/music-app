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

    def record_listen(
        self,
        *,
        user_id: str,
        song_id: str,
        artist_norm: str,
        album_norm: str,
        listened_seconds: float,
        completion_ratio: float,
        meaningful_play: bool,
    ) -> None:
        """Update only the preference fields needed for recommendations."""
        preference = 1.0 if completion_ratio >= 0.7 else (0.25 if completion_ratio >= 0.3 else -0.5)
        song_inc: dict[str, float | int] = {
            "listen_count": 1,
            "total_listened_seconds": round(listened_seconds, 2),
            "completion_ratio_sum": completion_ratio,
            "preference_score": preference,
        }
        if meaningful_play:
            song_inc["play_count"] = 1
        if completion_ratio >= 0.7:
            song_inc["high_completion_count"] = 1
        elif completion_ratio < 0.3:
            song_inc["skip_count"] = 1
        self._song_stats.update_one(
            {"user_id": user_id, "song_id": song_id},
            {"$inc": song_inc, "$set": {"last_played_at": datetime.now(timezone.utc).isoformat()}},
            upsert=True,
        )
        for collection, key, value in (
            (self._artist_stats, "artist_norm", artist_norm),
            (self._album_stats, "album_norm", album_norm),
        ):
            if not value:
                continue
            increments: dict[str, float | int] = {"preference_score": preference}
            if meaningful_play:
                increments["play_count"] = 1
            collection.update_one({"user_id": user_id, key: value}, {"$inc": increments}, upsert=True)

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

    def forgotten_song_ids(self, user_id: str, limit: int = 10) -> list[str]:
        """Loved tracks not revisited lately; skips are deliberately excluded."""
        rows = self._song_stats.find({"user_id": user_id, "play_count": {"$gte": 2}}, {"_id": 0}).sort([("last_played_at", 1), ("preference_score", -1)]).limit(limit)
        return [row["song_id"] for row in rows if row.get("song_id")]

    def listening_summary(self, user_id: str) -> dict[str, int | float]:
        row = next(iter(self._song_stats.aggregate([
            {"$match": {"user_id": user_id}},
            {"$group": {"_id": None, "songs": {"$sum": 1}, "plays": {"$sum": "$play_count"}, "seconds": {"$sum": "$total_listened_seconds"}}},
        ])), {})
        return {"unique_songs": int(row.get("songs", 0)), "plays": int(row.get("plays", 0)), "minutes": round(float(row.get("seconds", 0)) / 60, 1)}

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

    @staticmethod
    def _preference_map(collection: Any, user_id: str, key: str) -> dict[str, float]:
        return {
            row[key]: float(row.get("preference_score", 0))
            for row in collection.find({"user_id": user_id}, {"_id": 0})
            if row.get(key)
        }

    def artist_preference_map(self, user_id: str) -> dict[str, float]:
        return self._preference_map(self._artist_stats, user_id, "artist_norm")

    def album_preference_map(self, user_id: str) -> dict[str, float]:
        return self._preference_map(self._album_stats, user_id, "album_norm")

    def song_preference_map(self, user_id: str) -> dict[str, float]:
        return self._preference_map(self._song_stats, user_id, "song_id")
