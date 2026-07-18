"""Candidate + source abstractions."""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any

from app.services.recommendation.context import RadioContext


@dataclass
class Candidate:
    """A recommendation candidate and the named signals that support it."""

    song: dict[str, Any]
    signals: dict[str, float] = field(default_factory=dict)
    #: Final policy score, assigned by the engine before layout.
    score: float = 0.0

    @property
    def key(self) -> str | None:
        """Stable de-duplication key: local id, else external video id."""
        song_id = self.song.get("id")
        if song_id:
            return song_id
        vid = self.song.get("yt_video_id")
        return f"external:{vid}" if vid else None


class CandidateSource(ABC):
    """Produces candidates for a seed. Must be side-effect free and resilient."""

    #: Human-readable name (used in logs / debugging).
    name: str = "source"

    @abstractmethod
    def collect(self, ctx: RadioContext) -> list[Candidate]:
        raise NotImplementedError
