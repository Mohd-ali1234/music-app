"""Listening analytics use-cases: sessions, progress reporting, and events.

Progress reporting (the endpoint historically named "heartbeat") is *not* a
keep-alive poll — the client flushes accumulated listened-seconds only when it
has ~10s to report, on pause, and on seek. The former server-side waste was a
read-modify-write plus a no-op ``$inc: {play_count: 0}`` upsert on every call;
both are gone. Progress is now merged in a single atomic ``$addToSet`` update.

Play *counting* happens exactly once, in :meth:`record_event` on a ``play``
event, so recommendation and profile stats stay correct without the progress
endpoint. See the module docstring in :mod:`app.repositories.analytics`.
"""
from __future__ import annotations

from typing import Any

from fastapi import HTTPException

from app.repositories import AnalyticsRepository, SongRepository, UserStatsRepository
from app.schemas.analytics import (
    InteractionEvent,
    SessionEnd,
    SessionHeartbeat,
    SessionStart,
)


class AnalyticsService:
    def __init__(
        self,
        analytics: AnalyticsRepository,
        stats: UserStatsRepository,
        songs: SongRepository,
    ) -> None:
        self._analytics = analytics
        self._stats = stats
        self._songs = songs

    def start_session(self, user_id: str, body: SessionStart) -> dict[str, Any]:
        session_id = self._analytics.create_session(user_id, body.device, body.context)
        return {"session_id": session_id}

    def record_progress(
        self, user_id: str, body: SessionHeartbeat
    ) -> dict[str, Any]:
        matched = self._analytics.record_progress(
            session_id=body.session_id,
            user_id=user_id,
            song_id=body.song_id,
            yt_video_id=body.yt_video_id,
            artist_norm=body.artist_norm,
            album_norm=body.album_norm,
        )
        if not matched:
            raise HTTPException(status_code=404, detail="session not found")
        return {"ok": True}

    def end_session(self, user_id: str, body: SessionEnd) -> dict[str, Any]:
        self._analytics.end_session(body.session_id, user_id, body.duration_sec)
        return {"ok": True}

    def record_event(self, user_id: str, body: InteractionEvent) -> dict[str, Any]:
        event = self._analytics.insert_event(
            user_id=user_id,
            event_type=body.type,
            song_id=body.song_id,
            yt_video_id=body.yt_video_id,
            context=body.context,
        )
        if body.type == "play" and body.song_id:
            self._record_play(user_id, body.song_id)
        return {"ok": True, "event_id": event["id"]}

    def _record_play(self, user_id: str, song_id: str) -> None:
        self._stats.increment_song_play(user_id, song_id)
        song = self._songs.get_norm_fields(song_id)
        if not song:
            return
        if song.get("artist_norm"):
            self._stats.increment_artist_play(user_id, song["artist_norm"])
        if song.get("album_norm"):
            self._stats.increment_album_play(user_id, song["album_norm"])
