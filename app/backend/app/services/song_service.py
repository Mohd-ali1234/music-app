"""Song use-cases: catalog materialization and stream URL resolution."""
from __future__ import annotations

from typing import Any

from fastapi import HTTPException

from app.domain import build_local_song_doc, song_json
from app.providers import YouTubeClient
from app.repositories import SongRepository
from app.schemas.song import MaterializeIn


class SongService:
    def __init__(self, songs: SongRepository, youtube: YouTubeClient) -> None:
        self._songs = songs
        self._youtube = youtube

    def materialize(self, user_id: str, body: MaterializeIn) -> dict[str, Any]:
        """First-write-wins for canonical catalog fields.

        The first submission for a ``yt_video_id`` creates the shared catalog
        row. Later submissions are recorded per-user in ``song_submissions`` but
        never overwrite the shared row.
        """
        existing = self._songs.get_by_yt_video_id(body.yt_video_id)
        if existing:
            self._songs.record_submission(
                existing["id"], user_id, body.title, body.artist,
                body.album, body.artwork_url,
            )
            return {"song": song_json(existing), "created": False}

        doc = build_local_song_doc(
            yt_video_id=body.yt_video_id,
            title=body.title,
            artist=body.artist,
            album=body.album,
            artwork_url=body.artwork_url,
            duration_sec=body.duration_sec,
        )
        doc["created_by"] = user_id
        try:
            self._songs.insert(doc)
        except Exception:
            # Lost a race to another concurrent insert — return the winner.
            existing = self._songs.get_by_yt_video_id(body.yt_video_id)
            if existing:
                return {"song": song_json(existing), "created": False}
            raise
        return {"song": song_json(doc), "created": True}

    def resolve_stream(self, song_id: str) -> dict[str, Any]:
        if song_id.startswith("external:"):
            yt_id: str | None = song_id.split(":", 1)[1]
        else:
            row = self._songs.get_by_id(song_id)
            if not row:
                raise HTTPException(status_code=404, detail="song not found")
            yt_id = row.get("yt_video_id")
        if not yt_id:
            raise HTTPException(status_code=404, detail="no yt_video_id for song")

        stream = self._youtube.resolve_stream(yt_id)
        if not stream:
            raise HTTPException(status_code=502, detail="failed to resolve stream")
        url, headers = stream
        return {"stream_url": url, "headers": headers, "yt_video_id": yt_id}
