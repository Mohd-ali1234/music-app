from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class SessionStart(BaseModel):
    device: str | None = None
    context: str | None = None  # "search" | "radio" | "playlist" | "library"


class SessionHeartbeat(BaseModel):
    session_id: str
    song_id: str
    yt_video_id: str | None = None
    position_sec: int = 0
    artist_norm: str | None = None
    album_norm: str | None = None


class SessionEnd(BaseModel):
    session_id: str
    duration_sec: int = 0


class InteractionEvent(BaseModel):
    type: str = Field(..., description="play|pause|skip|like|unlike|queue_add|radio_start")
    song_id: str | None = None
    yt_video_id: str | None = None
    context: dict[str, Any] | None = None
