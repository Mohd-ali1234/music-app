"""Home feed use-case.

Behaviour matches the previous ``/home/feed`` exactly (recently played, a
"made for you" row seeded from top artists, and top-artist chips) but the
per-item ``find_one`` fan-outs are replaced with two bulk queries.
"""
from __future__ import annotations

from typing import Any

from app.domain import song_json
from app.providers import YouTubeClient
from app.repositories import LibraryRepository, SongRepository, UserStatsRepository

_RECENT_LIMIT = 15
_TOP_ARTIST_LIMIT = 5
_PER_ARTIST_SONGS = 5
_MADE_FOR_YOU_LIMIT = 25


class HomeService:
    def __init__(
        self,
        library: LibraryRepository,
        stats: UserStatsRepository,
        songs: SongRepository,
        youtube: YouTubeClient,
    ) -> None:
        self._library = library
        self._stats = stats
        self._songs = songs
        self._youtube = youtube

    def feed(self, user_id: str) -> dict[str, Any]:
        recent_songs = self._recently_played(user_id)
        top_artists = self._stats.top_artists(user_id, limit=_TOP_ARTIST_LIMIT)
        made_for_you = self._made_for_you(top_artists, recent_songs)
        return {
            "recently_played": recent_songs,
            "made_for_you": made_for_you[:_MADE_FOR_YOU_LIMIT],
            "top_artists": [
                {"name": a["artist_norm"], "play_count": a.get("play_count", 0)}
                for a in top_artists
            ],
        }

    def _recently_played(self, user_id: str) -> list[dict[str, Any]]:
        entries = self._library.recent_entries(user_id, limit=_RECENT_LIMIT)
        songs_by_id = self._songs.map_by_ids(e["song_id"] for e in entries)
        return [
            song_json(songs_by_id[e["song_id"]])
            for e in entries
            if e["song_id"] in songs_by_id
        ]

    def _made_for_you(
        self, top_artists: list[dict[str, Any]], recent_songs: list[dict[str, Any]]
    ) -> list[dict[str, Any]]:
        raw: list[dict[str, Any]] = []
        for artist in top_artists:
            raw += self._youtube.search(
                f"{artist['artist_norm']} best songs", limit=_PER_ARTIST_SONGS
            )
        # Cold-start: brand-new user with no history at all.
        if not raw and not recent_songs:
            raw = self._youtube.search("top hits 2026", limit=15)

        # Dedupe by video id (first occurrence wins), then prefer the local
        # canonical copy. Local copies are fetched in a single bulk query.
        deduped: list[dict[str, Any]] = []
        seen: set[str] = set()
        for row in raw:
            vid = row.get("yt_video_id")
            if not vid or vid in seen:
                continue
            seen.add(vid)
            deduped.append(row)

        local_by_yt = {
            row["yt_video_id"]: row
            for row in self._songs.list_by_yt_video_ids(seen)
            if row.get("yt_video_id")
        }
        return [
            song_json(local_by_yt.get(row["yt_video_id"], row)) for row in deduped
        ]
