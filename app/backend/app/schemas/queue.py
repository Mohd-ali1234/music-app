from __future__ import annotations

from pydantic import BaseModel


class QueueGenIn(BaseModel):
    seed_song_id: str
    size: int = 25
