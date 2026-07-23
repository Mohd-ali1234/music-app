"""The AI DJ orchestrator.

One class owns the loop described in the feature brief:

    observe -> understand session -> recommendation engine -> queue generation
    -> improve ordering -> update queue -> observe reaction -> repeat

Each arrow is a separate module; this controller only sequences them. It holds
no ranking logic of its own, which is the point: the DJ *conducts* the existing
recommendation and queue-generation systems rather than replacing them.

Reuse boundaries, stated explicitly:

* Candidate retrieval, merging, personalization and scoring stay in
  :class:`~app.services.recommendation.engine.RadioEngine`, untouched.
* Seed resolution and queue sizing stay in
  :class:`~app.services.recommendation.queue_service.QueueService`, untouched.
* The DJ influences them only through the constructor arguments those classes
  already expose (a tuned ``ScoringPolicy`` and ``discovery_ratio``), then
  applies a session-aware pass on the result.

Failure policy: a DJ cycle must never break playback. If queue generation
fails, the cycle returns without a queue and the client keeps its current one.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

from app.providers import YouTubeClient
from app.repositories import (
    AnalyticsRepository,
    LibraryRepository,
    SongRepository,
    UserStatsRepository,
)
from app.services.dj.config import DJConfig
from app.services.dj.context import DJContext, DJContextBuilder
from app.services.dj.feedback import Feedback, FeedbackLearner
from app.services.dj.narration import Narration, NarrationService
from app.services.dj.queue_optimizer import OptimizedQueue, QueueOptimizer
from app.services.dj.session import DJSessionManager, SessionSnapshot, TrackReason
from app.services.dj.strategy import DJDecision, StrategyManager
from app.services.dj.tuning import build_discovery_ratio, build_policy
from app.services.recommendation.engine import RadioEngine
from app.services.recommendation.queue_service import QueueService

log = logging.getLogger(__name__)

#: Queue size requested from the engine. ``QueueService`` clamps to 20..30.
DEFAULT_QUEUE_SIZE = 25


@dataclass(frozen=True)
class DJCycle:
    """The outcome of one pass through the DJ loop."""

    session_id: str
    intent: str
    reason: str
    #: Present only when the queue was rebuilt this cycle.
    songs: list[dict[str, Any]] | None
    narration: Narration | None
    queue_version: int
    signals: dict[str, Any]
    notes: tuple[str, ...]

    @property
    def refreshed(self) -> bool:
        return self.songs is not None

    def to_response(self) -> dict[str, Any]:
        return {
            "session_id": self.session_id,
            "intent": self.intent,
            "reason": self.reason,
            "refreshed": self.refreshed,
            "songs": self.songs,
            "narration": self.narration.to_document() if self.narration else None,
            "queue_version": self.queue_version,
            "signals": self.signals,
            "notes": list(self.notes),
        }


class DJController:
    """Runs the DJ loop over the existing recommendation stack."""

    def __init__(
        self,
        *,
        sessions: DJSessionManager,
        songs: SongRepository,
        analytics: AnalyticsRepository,
        stats: UserStatsRepository,
        library: LibraryRepository,
        youtube: YouTubeClient,
        context_builder: DJContextBuilder | None = None,
        strategy: StrategyManager | None = None,
        optimizer: QueueOptimizer | None = None,
        learner: FeedbackLearner | None = None,
        narrator: NarrationService | None = None,
    ) -> None:
        self._sessions = sessions
        self._songs = songs
        self._analytics = analytics
        self._stats = stats
        self._library = library
        self._youtube = youtube
        self._context = context_builder or DJContextBuilder(stats, library)
        self._strategy = strategy or StrategyManager()
        self._optimizer = optimizer or QueueOptimizer()
        self._learner = learner or FeedbackLearner()
        self._narrator = narrator or NarrationService()

    # --- configuration ---
    def get_config(self, user_id: str) -> DJConfig:
        return self._sessions.load_config(user_id)

    def update_config(self, user_id: str, patch: dict[str, Any]) -> DJConfig:
        merged = self._sessions.load_config(user_id).merged_with(patch)
        return self._sessions.save_config(user_id, merged)

    # --- lifecycle ---
    def start(
        self, user_id: str, seed_song_id: str, *, local_hour: int | None = None
    ) -> DJCycle:
        """Open a session and build its opening queue."""
        session = self._sessions.start(user_id, seed_song_id)
        return self._run(session, seed_song_id, local_hour=local_hour, force_refresh=True)

    def end(self, user_id: str, session_id: str) -> bool:
        return self._sessions.end(session_id, user_id)

    def get_session(self, user_id: str, session_id: str) -> SessionSnapshot | None:
        return self._sessions.get(session_id, user_id)

    def build_context(
        self, session: SessionSnapshot, *, local_hour: int | None = None
    ) -> DJContext:
        return self._context.build(session, local_hour=local_hour)

    # --- the loop ---
    def observe(
        self,
        user_id: str,
        session_id: str,
        *,
        song_id: str,
        reason: TrackReason,
        completion: float,
        current_song_id: str | None = None,
        local_hour: int | None = None,
    ) -> DJCycle | None:
        """Record a reaction, then let the DJ decide what to do about it.

        Returns ``None`` when the session cannot be found — the caller should
        treat that as "DJ not active" rather than an error, because analytics
        reporting must never fail a playback flow.
        """
        session = self._sessions.get(session_id, user_id)
        if session is None:
            return None

        song = self._songs.get_by_id(song_id) or {"id": song_id}
        session = self._sessions.observe(
            session, song=song, reason=reason, completion=completion
        )
        seed = current_song_id or song_id
        return self._run(session, seed, local_hour=local_hour, force_refresh=False)

    def advance(
        self,
        user_id: str,
        session_id: str,
        *,
        current_song_id: str,
        local_hour: int | None = None,
        force_refresh: bool = False,
    ) -> DJCycle | None:
        """Ask the DJ for a decision without reporting a new reaction."""
        session = self._sessions.get(session_id, user_id)
        if session is None:
            return None
        return self._run(
            session, current_song_id, local_hour=local_hour, force_refresh=force_refresh
        )

    # --- one cycle ---
    def _run(
        self,
        session: SessionSnapshot,
        seed_song_id: str,
        *,
        local_hour: int | None,
        force_refresh: bool,
    ) -> DJCycle:
        ctx = self._context.build(session, local_hour=local_hour)
        decision = self._strategy.decide(ctx)
        feedback = self._learner.learn(ctx)

        songs: list[dict[str, Any]] | None = None
        optimized: OptimizedQueue | None = None
        if ctx.config.enabled and (force_refresh or decision.should_refresh_queue):
            optimized = self._build_queue(ctx, decision, feedback, seed_song_id)
            songs = optimized.songs if optimized else None

        narration = self._narrator.narrate(ctx, decision) if ctx.config.enabled else None

        strategy_doc = decision.to_document(at_track=ctx.tracks_played)
        if narration:
            strategy_doc["narrated_at_track"] = ctx.tracks_played
        elif session.strategy:
            # Preserve the last narration checkpoint so the cooldown survives
            # cycles that produced no line.
            strategy_doc["narrated_at_track"] = session.strategy.get(
                "narrated_at_track", 0
            )
        if optimized:
            strategy_doc["queue_shaping"] = optimized.to_document()

        self._sessions.record_decision(
            session,
            strategy=strategy_doc,
            narration=narration.to_document() if narration else None,
        )

        return DJCycle(
            session_id=session.id,
            intent=decision.intent,
            reason=decision.reason,
            songs=songs,
            narration=narration,
            queue_version=session.queue_version + 1,
            signals=_signals(ctx, decision, feedback),
            notes=feedback.notes,
        )

    def _build_queue(
        self,
        ctx: DJContext,
        decision: DJDecision,
        feedback: Feedback,
        seed_song_id: str,
    ) -> OptimizedQueue | None:
        """Generate a queue through the existing engine, then DJ-shape it."""
        engine = RadioEngine(
            policy=build_policy(ctx.config, decision, feedback),
            discovery_ratio=build_discovery_ratio(ctx.config, decision, feedback),
        )
        service = QueueService(
            songs=self._songs,
            analytics=self._analytics,
            stats=self._stats,
            library=self._library,
            youtube=self._youtube,
            engine=engine,
        )
        try:
            raw = service.create_queue(
                seed_song_id=seed_song_id,
                user_id=ctx.session.user_id,
                size=DEFAULT_QUEUE_SIZE,
            )
        except ValueError:
            # Unknown seed (e.g. a song deleted mid-session). Not fatal.
            log.info("DJ queue skipped: unknown seed %s", seed_song_id)
            return None
        except Exception:  # noqa: BLE001 - the DJ must never break playback
            log.warning("DJ queue generation failed", exc_info=True)
            return None

        return self._optimizer.optimize(
            queue=raw, ctx=ctx, decision=decision, feedback=feedback
        )


def _signals(ctx: DJContext, decision: DJDecision, feedback: Feedback) -> dict[str, Any]:
    """The observable state behind this decision, for UI and debugging."""
    return {
        "skip_rate": ctx.skip_rate,
        "completion_rate": ctx.completion_rate,
        "replay_rate": ctx.replay_rate,
        "skip_streak": ctx.skip_streak,
        "energy": ctx.current_energy,
        "energy_trend": ctx.energy_trend,
        "energy_bias": decision.energy_bias,
        "discovery_bias": decision.discovery_bias,
        "artist_saturation": ctx.artist_saturation,
        "dominant_artist": ctx.dominant_artist,
        "tracks_played": ctx.tracks_played,
        "elapsed_minutes": ctx.elapsed_minutes,
        "time_of_day": ctx.time_of_day,
        "suppressed_artists": sorted(feedback.suppressed_artists),
    }
