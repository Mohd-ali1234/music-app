"""Access to listening telemetry: ``listening_sessions`` + ``interaction_events``.

This telemetry feeds the co-occurrence recommendation signal. Note that song
membership is captured both from session progress reports *and* from ``play``
interaction events, so co-occurrence keeps working even if progress reporting
(the former "heartbeat") is disabled.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from pymongo.database import Database


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class AnalyticsRepository:
    def __init__(self, db: Database) -> None:
        self._sessions = db.listening_sessions
        self._events = db.interaction_events

    # --- sessions ---
    def create_session(
        self, user_id: str, device: str | None, context: str | None
    ) -> str:
        session_id = str(uuid.uuid4())
        self._sessions.insert_one({
            "id": session_id,
            "user_id": user_id,
            "device": device,
            "context": context,
            "started_at": _now_iso(),
            "song_ids": [],
            "song_yt_ids": [],
            "artist_norms": [],
            "album_norms": [],
        })
        return session_id

    def record_progress(
        self,
        session_id: str,
        user_id: str,
        song_id: str | None,
        yt_video_id: str | None,
        artist_norm: str | None,
        album_norm: str | None,
    ) -> bool:
        """Merge progress into a session in a single atomic write.

        ``$addToSet`` is idempotent, so no read-before-write is needed. Returns
        ``True`` if the session existed (and was updated), else ``False``.
        """
        add_to_set: dict[str, Any] = {}
        if song_id:
            add_to_set["song_ids"] = song_id
        if yt_video_id:
            add_to_set["song_yt_ids"] = yt_video_id
        if artist_norm:
            add_to_set["artist_norms"] = artist_norm
        if album_norm:
            add_to_set["album_norms"] = album_norm

        ops: dict[str, Any] = {"$set": {"last_heartbeat_at": _now_iso()}}
        if add_to_set:
            ops["$addToSet"] = add_to_set
        result = self._sessions.update_one(
            {"id": session_id, "user_id": user_id}, ops
        )
        return result.matched_count > 0

    def end_session(self, session_id: str, user_id: str, duration_sec: int) -> None:
        self._sessions.update_one(
            {"id": session_id, "user_id": user_id},
            {"$set": {"ended_at": _now_iso(), "duration_sec": duration_sec}},
        )

    # --- interaction events ---
    def insert_event(
        self,
        user_id: str,
        event_type: str,
        song_id: str | None,
        yt_video_id: str | None,
        context: dict[str, Any] | None,
    ) -> dict[str, Any]:
        doc = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "type": event_type,
            "song_id": song_id,
            "yt_video_id": yt_video_id,
            "context": context or {},
            "created_at": _now_iso(),
        }
        self._events.insert_one(doc)
        doc.pop("_id", None)
        return doc

    def count_play_events(self, user_id: str) -> int:
        return self._events.count_documents({"user_id": user_id, "type": "play"})

    # --- recommendation signal: co-occurrence ---
    def co_occurring_yt_ids(
        self, seed_yt_id: str, seed_artist_norm: str, limit: int = 500
    ) -> dict[str, int]:
        """Count how often other tracks share a session with the seed track."""
        if not seed_yt_id and not seed_artist_norm:
            return {}
        match: dict[str, Any] = {}
        if seed_yt_id:
            match["song_yt_ids"] = seed_yt_id
        elif seed_artist_norm:
            match["artist_norms"] = seed_artist_norm

        counts: dict[str, int] = {}
        try:
            cursor = self._sessions.find(
                match, {"_id": 0, "song_yt_ids": 1}
            ).limit(limit)
            for session in cursor:
                for vid in session.get("song_yt_ids") or []:
                    if vid and vid != seed_yt_id:
                        counts[vid] = counts.get(vid, 0) + 1
        except Exception:
            return {}
        return counts
