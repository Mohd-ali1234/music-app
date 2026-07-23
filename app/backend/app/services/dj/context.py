"""Turn raw session state into the behaviour signals the DJ reasons over.

The context builder is the DJ's *perception* layer. It reads a
:class:`~app.services.dj.session.SessionSnapshot` plus the long-term stores the
app already maintains (``UserStatsRepository``, ``LibraryRepository``) and
produces a single flat, immutable :class:`DJContext`.

Everything here is cheap arithmetic over data already in memory or a small
number of pre-aggregated reads — no LLM, no fan-out scans. The strategy layer
consumes only this object, which keeps decision-making testable and makes it
obvious exactly which inputs can influence the DJ.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal

from app.repositories import LibraryRepository, UserStatsRepository
from app.services.dj.config import DJConfig
from app.services.dj.session import SessionSnapshot

#: Coarse part-of-day bucket. Derived from the *client's* local hour when it is
#: supplied, because server time says nothing useful about a global audience.
TimeOfDay = Literal["night", "morning", "afternoon", "evening"]

#: How many trailing observations count as "recent" for trend detection.
RECENT_WINDOW = 6
#: A session shorter than this is still warming up; trends are unreliable.
WARMUP_TRACKS = 3


def bucket_for_hour(hour: int | None) -> TimeOfDay:
    """Map a 0-23 local hour onto a part-of-day bucket."""
    if hour is None or not 0 <= hour <= 23:
        return "afternoon"
    if hour < 6:
        return "night"
    if hour < 12:
        return "morning"
    if hour < 18:
        return "afternoon"
    return "evening"


@dataclass(frozen=True)
class DJContext:
    """A complete, flat picture of the listening session right now."""

    session: SessionSnapshot
    config: DJConfig

    # --- in-session reception ---
    skip_rate: float
    completion_rate: float
    replay_rate: float
    skip_streak: int

    # --- in-session shape ---
    current_energy: float
    energy_trend: float
    artist_saturation: float
    dominant_artist: str | None
    tracks_played: int
    elapsed_minutes: float

    # --- long-term listener profile ---
    top_artist_norms: tuple[str, ...]
    liked_count: int
    is_warmup: bool
    returning_after_break: bool

    # --- environment ---
    time_of_day: TimeOfDay

    @property
    def is_rejecting(self) -> bool:
        """The listener is clearly unhappy with the current direction."""
        return self.skip_streak >= 2 or (
            not self.is_warmup and self.skip_rate >= 0.5
        )

    @property
    def is_locked_in(self) -> bool:
        """The listener is deeply engaged — do not disturb the vibe."""
        return not self.is_warmup and self.completion_rate >= 0.7 and self.skip_streak == 0

    @property
    def is_saturated(self) -> bool:
        """One artist is dominating the session."""
        return self.artist_saturation >= 0.45 and self.tracks_played >= 4


class DJContextBuilder:
    """Assembles a :class:`DJContext` from session state and long-term stores."""

    def __init__(self, stats: UserStatsRepository, library: LibraryRepository) -> None:
        self._stats = stats
        self._library = library

    def build(
        self,
        session: SessionSnapshot,
        *,
        local_hour: int | None = None,
    ) -> DJContext:
        observations = session.observations
        total = len(observations)

        skips = sum(1 for o in observations if o.is_skip)
        completions = sum(1 for o in observations if o.is_completion)
        replays = int(session.metrics.get("replays", 0))

        recent = session.recent(RECENT_WINDOW)
        current_energy = (
            round(sum(o.energy for o in recent) / len(recent), 4) if recent else 0.5
        )

        artist_counts = session.artist_counts
        played_total = sum(artist_counts.values()) or 1
        dominant_artist, dominant_count = _dominant(artist_counts)

        return DJContext(
            session=session,
            config=session.config,
            skip_rate=round(skips / total, 4) if total else 0.0,
            completion_rate=round(completions / total, 4) if total else 0.0,
            replay_rate=round(replays / total, 4) if total else 0.0,
            skip_streak=session.trailing_skip_streak(),
            current_energy=current_energy,
            energy_trend=_trend([o.energy for o in recent]),
            artist_saturation=round(dominant_count / played_total, 4),
            dominant_artist=dominant_artist,
            tracks_played=session.track_count,
            elapsed_minutes=session.elapsed_minutes,
            top_artist_norms=self._top_artists(session.user_id),
            liked_count=self._liked_count(session.user_id),
            is_warmup=total < WARMUP_TRACKS,
            returning_after_break=total == 0 and session.queue_version == 0,
            time_of_day=bucket_for_hour(local_hour),
        )

    # --- long-term reads (each guarded: the DJ must survive a cold store) ---
    def _top_artists(self, user_id: str) -> tuple[str, ...]:
        try:
            rows = self._stats.top_artists(user_id, limit=8)
        except Exception:  # noqa: BLE001 - profile reads must never break the DJ
            return ()
        return tuple(r["artist_norm"] for r in rows if r.get("artist_norm"))

    def _liked_count(self, user_id: str) -> int:
        try:
            return self._library.count_likes(user_id)
        except Exception:  # noqa: BLE001
            return 0


def _dominant(counts: dict[str, int]) -> tuple[str | None, int]:
    """Return the most-played artist and its count, or ``(None, 0)``."""
    if not counts:
        return None, 0
    artist = max(counts, key=lambda key: counts[key])
    return artist, counts[artist]


def _trend(values: list[float]) -> float:
    """Signed drift across ``values``, normalized to roughly ``-1.0..1.0``.

    Compares the mean of the second half against the first half. Two points or
    fewer carry no meaningful trend, so those return ``0.0``.
    """
    if len(values) < 3:
        return 0.0
    midpoint = len(values) // 2
    first = values[:midpoint]
    second = values[midpoint:]
    delta = (sum(second) / len(second)) - (sum(first) / len(first))
    return round(max(-1.0, min(1.0, delta * 2)), 4)
