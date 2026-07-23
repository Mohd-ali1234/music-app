"""Post-process a generated queue into something a DJ would actually play.

The radio engine returns a well-ranked, seed-relevant queue. This module adds
the *session-aware* pass the engine deliberately has no knowledge of, because
the engine is stateless with respect to what you have already heard:

* drop tracks already played in this session (repetition is the fastest way to
  make a radio feel broken),
* drop tracks the listener just skipped,
* cap how many times any one artist may appear,
* set aside artists the session's :class:`~app.services.dj.feedback.Feedback`
  has judged unwelcome,
* hand the survivors to :class:`~app.services.dj.transition.TransitionManager`
  for ordering.

Filtering is *never* allowed to empty the queue: every rule degrades to
"keep it anyway" rather than returning nothing. A short queue is a bug; an
empty queue is a broken player.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from app.services.dj.config import DJConfig
from app.services.dj.context import DJContext
from app.services.dj.feedback import Feedback
from app.services.dj.strategy import DJDecision
from app.services.dj.transition import TransitionManager

#: Never return fewer than this many upcoming tracks if candidates exist.
MIN_UPCOMING = 8


@dataclass(frozen=True)
class OptimizedQueue:
    """The DJ's final queue plus a record of what shaping was applied."""

    songs: list[dict[str, Any]]
    dropped_repeats: int
    dropped_skipped: int
    dropped_artist_cap: int
    dropped_suppressed: int

    @property
    def size(self) -> int:
        return len(self.songs)

    def to_document(self) -> dict[str, Any]:
        return {
            "dropped_repeats": self.dropped_repeats,
            "dropped_skipped": self.dropped_skipped,
            "dropped_artist_cap": self.dropped_artist_cap,
            "dropped_suppressed": self.dropped_suppressed,
        }


class QueueOptimizer:
    """Applies session memory and flow rules to an engine-generated queue."""

    def __init__(self, transitions: TransitionManager | None = None) -> None:
        self._transitions = transitions or TransitionManager()

    def optimize(
        self,
        *,
        queue: list[dict[str, Any]],
        ctx: DJContext,
        decision: DJDecision,
        feedback: Feedback | None = None,
    ) -> OptimizedQueue:
        """Shape ``queue`` (seed first) into the queue the DJ will play."""
        if not queue:
            return OptimizedQueue([], 0, 0, 0, 0)

        seed, candidates = queue[0], list(queue[1:])
        if not candidates:
            return OptimizedQueue([seed], 0, 0, 0, 0)

        config = ctx.config
        # A "rediscover" set is *supposed* to revisit loved tracks, so the
        # already-played filter is relaxed for that intent only.
        allow_repeats = decision.intent == "rediscover"

        kept, stats = self._filter(
            candidates,
            ctx=ctx,
            config=config,
            allow_repeats=allow_repeats,
            feedback=feedback or Feedback(),
        )
        if not kept:
            # Every candidate was filtered out — better to repeat than to stall.
            kept, stats = list(candidates), _FilterStats()

        ordered = self._transitions.arrange(
            seed=seed,
            tracks=kept,
            config=config,
            energy_bias=decision.energy_bias,
        )
        return OptimizedQueue(
            songs=[seed, *ordered],
            dropped_repeats=stats.repeats,
            dropped_skipped=stats.skipped,
            dropped_artist_cap=stats.artist_cap,
            dropped_suppressed=stats.suppressed,
        )

    # --- filtering ---
    def _filter(
        self,
        candidates: list[dict[str, Any]],
        *,
        ctx: DJContext,
        config: DJConfig,
        allow_repeats: bool,
        feedback: Feedback,
    ) -> tuple[list[dict[str, Any]], "_FilterStats"]:
        played = ctx.session.played_song_ids
        skipped = {
            o.song_id for o in ctx.session.observations if o.is_skip and o.song_id
        }
        cap = config.max_tracks_per_artist
        artist_used: dict[str, int] = {}
        stats = _FilterStats()
        kept: list[dict[str, Any]] = []
        deferred: list[dict[str, Any]] = []

        for song in candidates:
            song_id = song.get("id") or ""

            if song_id and song_id in skipped:
                stats.skipped += 1
                continue

            if not allow_repeats and song_id and song_id in played:
                stats.repeats += 1
                # A repeat is only *preferable* to an empty queue, so hold it
                # aside rather than discarding it outright.
                deferred.append(song)
                continue

            artist = (song.get("artist_norm") or song.get("artist") or "").casefold()
            if artist and artist in feedback.suppressed_artists:
                stats.suppressed += 1
                deferred.append(song)
                continue

            if artist:
                used = artist_used.get(artist, 0)
                if used >= cap:
                    stats.artist_cap += 1
                    deferred.append(song)
                    continue
                artist_used[artist] = used + 1

            kept.append(song)

        # Backfill from the deferred pool only if the queue came out too thin.
        if len(kept) < MIN_UPCOMING and deferred:
            shortfall = MIN_UPCOMING - len(kept)
            kept.extend(deferred[:shortfall])

        return kept, stats


@dataclass
class _FilterStats:
    repeats: int = 0
    skipped: int = 0
    artist_cap: int = 0
    suppressed: int = 0
