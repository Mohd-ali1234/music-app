from __future__ import annotations

from pydantic import BaseModel, Field


class MaterializeIn(BaseModel):
    yt_video_id: str = Field(min_length=11, max_length=11)
    title: str
    artist: str
    album: str = ""
    artwork_url: str = ""
    duration_sec: int | None = None
