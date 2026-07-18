"""Song domain helpers: canonical document builder + wire serializer.

``song_json`` is the single source of truth for the song shape returned by the
API. It is intentionally idempotent — passing an already-serialized song back
through it yields the same result — so callers can serialize defensively.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from app.utils.text import normalize_artist, normalize_title


def song_json(doc: dict[str, Any]) -> dict[str, Any]:
    """Serialize a song dict (local row or external result) to the wire format.

    Both ``artwork_url``/``artwork`` and ``duration_sec``/``duration`` are
    emitted because different client versions read different keys; keeping both
    preserves backwards compatibility.
    """
    yt_id = doc.get("yt_video_id")
    is_external = bool(doc.get("_external"))
    song_id = doc.get("id") or (f"external:{yt_id}" if yt_id else None)
    artwork = doc.get("artwork_url") or doc.get("artwork") or ""
    duration = doc.get("duration_sec")
    if duration is None:
        duration = doc.get("duration")
    return {
        "id": song_id,
        "yt_video_id": yt_id,
        "title": doc.get("title", ""),
        "artist": doc.get("artist", ""),
        "album": doc.get("album") or "",
        "artwork_url": artwork,
        "artwork": artwork,
        "duration_sec": duration,
        "duration": duration,
        "is_external": is_external
        or (isinstance(song_id, str) and song_id.startswith("external:")),
    }


def build_local_song_doc(
    yt_video_id: str,
    title: str,
    artist: str,
    album: str = "",
    artwork_url: str = "",
    duration_sec: int | None = None,
) -> dict[str, Any]:
    """Build a canonical catalog document for a newly materialized song."""
    return {
        "id": str(uuid.uuid4()),
        "yt_video_id": yt_video_id,
        "title": title,
        "artist": artist,
        "album": album,
        "artwork_url": artwork_url,
        "duration_sec": duration_sec,
        "title_norm": normalize_title(title),
        "artist_norm": normalize_artist(artist),
        "album_norm": normalize_title(album),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": None,
    }
