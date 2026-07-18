"""Immutable request context shared by every candidate source."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from app.providers import YouTubeClient
from app.repositories import AnalyticsRepository, SongRepository, UserStatsRepository
from app.utils.text import normalize_artist, normalize_title


@dataclass(frozen=True)
class RadioContext:
    seed: dict[str, Any]
    user_id: str | None

    # Pre-computed seed descriptors (normalized + display forms).
    seed_id: str
    seed_yt_id: str
    seed_artist_norm: str
    seed_album_norm: str
    seed_title_norm: str
    seed_artist_display: str
    seed_title_display: str

    # Collaborators.
    songs: SongRepository
    analytics: AnalyticsRepository
    stats: UserStatsRepository
    youtube: YouTubeClient

    @classmethod
    def build(
        cls,
        seed: dict[str, Any],
        user_id: str | None,
        *,
        songs: SongRepository,
        analytics: AnalyticsRepository,
        stats: UserStatsRepository,
        youtube: YouTubeClient,
    ) -> "RadioContext":
        artist_display = seed.get("artist") or ""
        title_display = seed.get("title") or ""
        return cls(
            seed=seed,
            user_id=user_id,
            seed_id=seed.get("id") or "",
            seed_yt_id=seed.get("yt_video_id") or "",
            seed_artist_norm=seed.get("artist_norm") or normalize_artist(artist_display),
            seed_album_norm=seed.get("album_norm")
            or normalize_title(seed.get("album") or ""),
            seed_title_norm=seed.get("title_norm") or normalize_title(title_display),
            seed_artist_display=artist_display,
            seed_title_display=title_display,
            songs=songs,
            analytics=analytics,
            stats=stats,
            youtube=youtube,
        )

    def is_seed(self, song: dict[str, Any]) -> bool:
        """True if ``song`` is the seed track (by id or video id)."""
        if self.seed_id and song.get("id") == self.seed_id:
            return True
        if self.seed_yt_id and song.get("yt_video_id") == self.seed_yt_id:
            return True
        return False
