from __future__ import annotations

from pydantic import BaseModel, Field


class ListenIn(BaseModel):
    """One final listening record, sent when the user leaves a track."""

    song_id: str
    listened_seconds: float = Field(ge=0)
    duration_seconds: float = Field(gt=0)
    reason: str = Field(pattern="^(skipped|completed|stopped)$")
