"""Access to the shared ``songs`` catalog collection."""
from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any, Iterable

from pymongo.database import Database

_NO_MONGO_ID = {"_id": 0}


class SongRepository:
    def __init__(self, db: Database) -> None:
        self._songs = db.songs
        self._submissions = db.song_submissions

    # --- single-document reads ---
    def get_by_id(self, song_id: str) -> dict[str, Any] | None:
        return self._songs.find_one({"id": song_id}, _NO_MONGO_ID)

    def get_by_yt_video_id(self, yt_video_id: str) -> dict[str, Any] | None:
        return self._songs.find_one({"yt_video_id": yt_video_id}, _NO_MONGO_ID)

    def get_yt_video_id(self, song_id: str) -> str | None:
        row = self._songs.find_one({"id": song_id}, {"_id": 0, "yt_video_id": 1})
        return row.get("yt_video_id") if row else None

    def get_norm_fields(self, song_id: str) -> dict[str, Any] | None:
        return self._songs.find_one(
            {"id": song_id}, {"_id": 0, "artist_norm": 1, "album_norm": 1}
        )

    # --- bulk reads ---
    def map_by_ids(self, song_ids: Iterable[str]) -> dict[str, dict[str, Any]]:
        ids = list(song_ids)
        if not ids:
            return {}
        return {
            s["id"]: s
            for s in self._songs.find({"id": {"$in": ids}}, _NO_MONGO_ID)
        }

    def list_by_ids(self, song_ids: Iterable[str]) -> list[dict[str, Any]]:
        ids = list(song_ids)
        if not ids:
            return []
        return list(self._songs.find({"id": {"$in": ids}}, _NO_MONGO_ID))

    def list_by_yt_video_ids(self, yt_video_ids: Iterable[str]) -> list[dict[str, Any]]:
        ids = [v for v in yt_video_ids if v]
        if not ids:
            return []
        return list(self._songs.find({"yt_video_id": {"$in": ids}}, _NO_MONGO_ID))

    # --- catalog candidate queries (used by the radio engine) ---
    def find_by_artist_norm(self, artist_norm: str, limit: int = 100) -> list[dict[str, Any]]:
        if not artist_norm:
            return []
        return list(
            self._songs.find({"artist_norm": artist_norm}, _NO_MONGO_ID).limit(limit)
        )

    def find_by_album_norm(self, album_norm: str, limit: int = 100) -> list[dict[str, Any]]:
        if not album_norm:
            return []
        return list(
            self._songs.find({"album_norm": album_norm}, _NO_MONGO_ID).limit(limit)
        )

    def find_by_fuzzy_artist_tokens(
        self, tokens: list[str], limit: int = 200
    ) -> list[dict[str, Any]]:
        """Match songs whose artist contains any of the given (long) tokens."""
        meaningful = [re.escape(t) for t in tokens if len(t) > 2]
        if not meaningful:
            return []
        pattern = "|".join(meaningful)
        return list(
            self._songs.find(
                {"artist_norm": {"$regex": pattern}}, _NO_MONGO_ID
            ).limit(limit)
        )

    # --- writes ---
    def insert(self, doc: dict[str, Any]) -> None:
        self._songs.insert_one(doc)

    def record_submission(
        self,
        song_id: str,
        user_id: str,
        title: str,
        artist: str,
        album: str,
        artwork_url: str,
    ) -> None:
        """Record a per-user metadata submission without touching the catalog."""
        self._submissions.update_one(
            {"song_id": song_id, "user_id": user_id},
            {"$set": {
                "submitted_at": datetime.now(timezone.utc).isoformat(),
                "title": title,
                "artist": artist,
                "album": album,
                "artwork_url": artwork_url,
            }},
            upsert=True,
        )
