"""Session lifecycle and the observation log the DJ reasons over.

A *DJ session* is one continuous listening stretch. It owns the memory the DJ
needs to behave like a person rather than a stateless recommender: what has
already played, how each track was received, which artists are saturating, and
what the DJ last said.

This module is the only writer of session state. Everything downstream
(:mod:`~app.services.dj.context`, :mod:`~app.services.dj.strategy`) reads a
snapshot and never mutates it.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Literal

from app.repositories import DJRepository
from app.repositories.dj import unescape_key
from app.services.dj.config import DJConfig
from app.services.dj.energy import estimate_energy

#: Why a track stopped playing. Mirrors ``ListenIn.reason`` so the existing
#: analytics contract and the DJ observation contract stay in lockstep.
TrackReason = Literal["skipped", "completed", "stopped"]

#: A completion ratio at or above this counts as genuine engagement.
COMPLETION_THRESHOLD = 0.70
#: Below this, leaving a track is treated as a rejection rather than a pause.
SKIP_THRESHOLD = 0.30


@dataclass(frozen=True)
class TrackObservation:
    """One recorded reaction to one track."""

    song_id: str
    title: str
    artist: str
    artist_norm: str
    reason: TrackReason
    completion: float
    energy: float
    at: str

    @property
    def is_skip(self) -> bool:
        """A deliberate rejection: left early *and* flagged as a skip."""
        return self.reason == "skipped" and self.completion < SKIP_THRESHOLD

    @property
    def is_completion(self) -> bool:
        return self.completion >= COMPLETION_THRESHOLD

    def to_document(self) -> dict[str, Any]:
        return {
            "song_id": self.song_id,
            "title": self.title,
            "artist": self.artist,
            "artist_norm": self.artist_norm,
            "reason": self.reason,
            "completion": round(self.completion, 4),
            "energy": self.energy,
            "at": self.at,
        }

    @classmethod
    def from_document(cls, doc: dict[str, Any]) -> "TrackObservation":
        return cls(
            song_id=str(doc.get("song_id") or ""),
            title=str(doc.get("title") or ""),
            artist=str(doc.get("artist") or ""),
            artist_norm=str(doc.get("artist_norm") or ""),
            reason=doc.get("reason") if doc.get("reason") in ("skipped", "completed", "stopped") else "stopped",  # type: ignore[arg-type]
            completion=float(doc.get("completion") or 0.0),
            energy=float(doc.get("energy") or 0.5),
            at=str(doc.get("at") or ""),
        )


@dataclass(frozen=True)
class SessionSnapshot:
    """An immutable read-model of a persisted DJ session."""

    id: str
    user_id: str
    seed_song_id: str
    config: DJConfig
    started_at: str
    observations: tuple[TrackObservation, ...]
    played_song_ids: frozenset[str]
    artist_counts: dict[str, int]
    strategy: dict[str, Any] | None
    narration_count: int
    narration_last_at: str | None
    narration_recent: tuple[str, ...]
    queue_version: int
    metrics: dict[str, int]

    @classmethod
    def from_document(cls, doc: dict[str, Any]) -> "SessionSnapshot":
        narration = doc.get("narration") or {}
        return cls(
            id=str(doc.get("id") or ""),
            user_id=str(doc.get("user_id") or ""),
            seed_song_id=str(doc.get("seed_song_id") or ""),
            config=DJConfig.from_document(doc.get("config")),
            started_at=str(doc.get("started_at") or ""),
            observations=tuple(
                TrackObservation.from_document(o) for o in doc.get("observations") or []
            ),
            played_song_ids=frozenset(doc.get("played_song_ids") or []),
            artist_counts={
                unescape_key(k): int(v)
                for k, v in (doc.get("artist_counts") or {}).items()
            },
            strategy=doc.get("strategy"),
            narration_count=int(narration.get("count") or 0),
            narration_last_at=narration.get("last_at"),
            narration_recent=tuple(narration.get("recent") or []),
            queue_version=int(doc.get("queue_version") or 0),
            metrics={k: int(v) for k, v in (doc.get("metrics") or {}).items()},
        )

    # --- derived behaviour signals ---
    @property
    def track_count(self) -> int:
        return int(self.metrics.get("tracks", 0))

    @property
    def elapsed_minutes(self) -> float:
        started = _parse_iso(self.started_at)
        if started is None:
            return 0.0
        delta = datetime.now(timezone.utc) - started
        return round(max(0.0, delta.total_seconds() / 60), 2)

    def recent(self, count: int) -> tuple[TrackObservation, ...]:
        return self.observations[-count:] if count > 0 else ()

    def trailing_skip_streak(self) -> int:
        """How many tracks in a row were just rejected."""
        streak = 0
        for observation in reversed(self.observations):
            if observation.is_skip:
                streak += 1
            else:
                break
        return streak


class DJSessionManager:
    """Creates, resumes, observes and closes DJ sessions."""

    def __init__(self, repo: DJRepository) -> None:
        self._repo = repo

    # --- settings ---
    def load_config(self, user_id: str) -> DJConfig:
        return DJConfig.from_document(self._repo.get_settings(user_id))

    def save_config(self, user_id: str, config: DJConfig) -> DJConfig:
        self._repo.save_settings(user_id, config.to_document())
        return config

    # --- lifecycle ---
    def start(self, user_id: str, seed_song_id: str) -> SessionSnapshot:
        config = self.load_config(user_id)
        doc = self._repo.create_session(user_id, seed_song_id, config.to_document())
        return SessionSnapshot.from_document(doc)

    def get(self, session_id: str, user_id: str) -> SessionSnapshot | None:
        doc = self._repo.get_session(session_id, user_id)
        return SessionSnapshot.from_document(doc) if doc else None

    def resume_or_start(self, user_id: str, seed_song_id: str) -> SessionSnapshot:
        """Reuse the user's open session when there is one, else open a new one."""
        doc = self._repo.latest_active_session(user_id)
        if doc:
            return SessionSnapshot.from_document(doc)
        return self.start(user_id, seed_song_id)

    def end(self, session_id: str, user_id: str) -> bool:
        return self._repo.end_session(session_id, user_id)

    # --- observation ---
    def observe(
        self,
        session: SessionSnapshot,
        *,
        song: dict[str, Any],
        reason: TrackReason,
        completion: float,
    ) -> SessionSnapshot:
        """Record one track outcome and return the refreshed session."""
        artist_norm = str(song.get("artist_norm") or "").strip()
        observation = TrackObservation(
            song_id=str(song.get("id") or ""),
            title=str(song.get("title") or ""),
            artist=str(song.get("artist") or ""),
            artist_norm=artist_norm,
            reason=reason,
            completion=max(0.0, min(1.0, completion)),
            energy=estimate_energy(song),
            at=datetime.now(timezone.utc).isoformat(),
        )

        increments: dict[str, int] = {"tracks": 1}
        if observation.is_skip:
            increments["skips"] = 1
        if observation.is_completion:
            increments["completions"] = 1
        if observation.song_id and observation.song_id in session.played_song_ids:
            increments["replays"] = 1

        updated = self._repo.append_observation(
            session.id,
            session.user_id,
            observation.to_document(),
            metric_increments=increments,
            artist_norm=artist_norm or None,
        )
        return SessionSnapshot.from_document(updated) if updated else session

    def record_decision(
        self,
        session: SessionSnapshot,
        *,
        strategy: dict[str, Any],
        narration: dict[str, Any] | None,
    ) -> None:
        self._repo.save_decision(
            session.id, session.user_id, strategy=strategy, narration=narration
        )


def _parse_iso(value: str) -> datetime | None:
    """Parse an ISO timestamp, always returning a timezone-aware value."""
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed
