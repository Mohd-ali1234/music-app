from __future__ import annotations

from pydantic import BaseModel, Field


class PlaylistCreateIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str = ""


class PlaylistFromSearchesIn(BaseModel):
    """Create a playlist by resolving supplied song queries on YouTube Music."""

    name: str = Field(min_length=1, max_length=120)
    description: str = ""
    song_queries: list[str] = Field(min_length=1, max_length=15)


class PlaylistFromPromptIn(BaseModel):
    prompt: str = Field(min_length=4, max_length=800)
    track_count: int = Field(default=12, ge=5, le=15)


class PlaylistUpdateIn(BaseModel):
    name: str | None = None
    description: str | None = None
    song_ids: list[str] | None = None
