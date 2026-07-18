from __future__ import annotations

from pydantic import BaseModel


class LikeIn(BaseModel):
    song_id: str


class RecentIn(BaseModel):
    song_id: str
