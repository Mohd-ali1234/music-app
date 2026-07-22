"""Queue use-case: resolve the seed and delegate to the radio engine."""
from __future__ import annotations

from typing import Any

from app.providers import YouTubeClient
from app.repositories import AnalyticsRepository, LibraryRepository, SongRepository, UserStatsRepository
from app.services.recommendation.context import RadioContext
from app.services.recommendation.engine import RadioEngine

# Queue sizes are clamped to this range (preserves prior behavior).
_MIN_SIZE = 20
_MAX_SIZE = 30


class QueueService:
    def __init__(
        self,
        songs: SongRepository,
        analytics: AnalyticsRepository,
        stats: UserStatsRepository,
        library: LibraryRepository,
        youtube: YouTubeClient,
        engine: RadioEngine | None = None,
    ) -> None:
        self._songs = songs
        self._analytics = analytics
        self._stats = stats
        self._library = library
        self._youtube = youtube
        self._engine = engine or RadioEngine()

    def create_queue(
        self, seed_song_id: str, user_id: str | None, size: int = 25
    ) -> list[dict[str, Any]]:
        seed = self._songs.get_by_id(seed_song_id)
        if not seed:
            raise ValueError("Song not found")
        size = max(_MIN_SIZE, min(_MAX_SIZE, size))
        ctx = RadioContext.build(
            seed,
            user_id,
            songs=self._songs,
            analytics=self._analytics,
            stats=self._stats,
            library=self._library,
            youtube=self._youtube,
        )
        return self._engine.build(ctx, size)
