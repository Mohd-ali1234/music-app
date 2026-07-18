from __future__ import annotations

from pydantic import BaseModel, Field


class PlaylistCreateIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str = ""


class PlaylistUpdateIn(BaseModel):
    name: str | None = None
    description: str | None = None
    song_ids: list[str] | None = None
