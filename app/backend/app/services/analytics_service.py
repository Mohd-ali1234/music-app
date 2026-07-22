"""Record one final listen and turn it into compact preference statistics."""
from __future__ import annotations

from fastapi import HTTPException

from app.repositories import AnalyticsRepository, SongRepository, UserStatsRepository
from app.schemas.analytics import ListenIn


class AnalyticsService:
    def __init__(self, analytics: AnalyticsRepository, stats: UserStatsRepository, songs: SongRepository) -> None:
        self._analytics = analytics
        self._stats = stats
        self._songs = songs

    def record_listen(self, user_id: str, body: ListenIn) -> dict[str, float | int | bool]:
        song = self._songs.get_norm_fields(body.song_id)
        if not song:
            raise HTTPException(status_code=404, detail="song not found")
        listened = min(body.listened_seconds, body.duration_seconds)
        ratio = min(listened / body.duration_seconds, 1.0)
        meaningful = listened >= min(30.0, body.duration_seconds * 0.5)
        self._analytics.insert_listen(
            user_id=user_id, song_id=body.song_id, listened_seconds=listened,
            duration_seconds=body.duration_seconds, completion_percent=round(ratio * 100), reason=body.reason,
        )
        self._stats.record_listen(
            user_id=user_id, song_id=body.song_id,
            artist_norm=song.get("artist_norm") or "", album_norm=song.get("album_norm") or "",
            listened_seconds=listened, completion_ratio=ratio, meaningful_play=meaningful,
        )
        return {"ok": True, "completion_percent": round(ratio * 100), "counted_as_play": meaningful}
