"""Request bodies for the AI DJ endpoints.

The observation payload deliberately mirrors
:class:`~app.schemas.analytics.ListenIn` (``listened_seconds`` /
``duration_seconds`` / ``reason``) so the client reports a finished track the
same way to both systems and the completion ratio is derived server-side in
exactly one way.
"""
from __future__ import annotations

from pydantic import BaseModel, Field


class DJStartIn(BaseModel):
    """Open a DJ session seeded by the track about to play."""

    seed_song_id: str
    #: The listener's local hour (0-23). Server time is meaningless for a
    #: global audience, so time-of-day decisions use this when supplied.
    local_hour: int | None = Field(default=None, ge=0, le=23)


class DJObserveIn(BaseModel):
    """Report how the listener reacted to one track."""

    song_id: str
    listened_seconds: float = Field(ge=0)
    duration_seconds: float = Field(gt=0)
    reason: str = Field(pattern="^(skipped|completed|stopped)$")
    #: The track now playing, used as the seed if the queue is rebuilt.
    #: Defaults to ``song_id`` when omitted.
    current_song_id: str | None = None
    local_hour: int | None = Field(default=None, ge=0, le=23)


class DJAdvanceIn(BaseModel):
    """Ask the DJ for a decision without reporting a new reaction."""

    current_song_id: str
    local_hour: int | None = Field(default=None, ge=0, le=23)
    #: Force a queue rebuild even if the strategy would not have asked for one
    #: (the "shuffle it up" button).
    force_refresh: bool = False


class DJConfigIn(BaseModel):
    """Partial update of the listener's DJ preferences.

    Every field is optional; omitted fields keep their stored value.
    """

    enabled: bool | None = None
    narration_frequency: float | None = Field(default=None, ge=0, le=1)
    discovery_level: float | None = Field(default=None, ge=0, le=1)
    energy_control: bool | None = None
    mood_consistency: float | None = Field(default=None, ge=0, le=1)
    artist_diversity: float | None = Field(default=None, ge=0, le=1)
    learning_aggressiveness: float | None = Field(default=None, ge=0, le=1)
