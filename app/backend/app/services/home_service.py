"""Home feed use-case.

Behaviour matches the previous ``/home/feed`` exactly (recently played, a
"made for you" row seeded from top artists, and top-artist chips) but the
per-item ``find_one`` fan-outs are replaced with two bulk queries.
"""
from __future__ import annotations

from typing import Any

from app.domain import song_json
from app.providers import YouTubeClient
from app.repositories import LibraryRepository, SongRepository, UserStatsRepository, UserRepository

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
        users: UserRepository | None = None,
    ) -> None:
        self._library = library
        self._stats = stats
        self._songs = songs
        self._youtube = youtube
        self._users = users

    def feed(self, user_id: str) -> dict[str, Any]:
        recent_songs = self._recently_played(user_id)
        top_artists = self._stats.top_artists(user_id, limit=_TOP_ARTIST_LIMIT)
        made_for_you = self._made_for_you(top_artists, recent_songs, user_id)
        top_songs = self._songs_for_ids([r.get("song_id", "") for r in self._stats.top_songs(user_id, limit=10)])
        forgotten = self._songs_for_ids(self._stats.forgotten_song_ids(user_id))
        liked = self._songs_for_ids(self._library.liked_song_ids(user_id)[:12])
        return {
            "recently_played": recent_songs,
            "made_for_you": made_for_you[:_MADE_FOR_YOU_LIMIT],
            "top_artists": [
                {"name": a["artist_norm"], "play_count": a.get("play_count", 0)}
                for a in top_artists
            ],
            "most_played": top_songs,
            "quick_picks": (recent_songs + made_for_you)[:12],
            "forgotten_favorites": forgotten,
            "liked_songs": liked,
            "favorite_genres": self._favorite_genres(user_id),
            "recommended_albums": self._recommended_albums(made_for_you),
            "listening_stats": self._stats.listening_summary(user_id),
        }

    def _songs_for_ids(self, ids: list[str]) -> list[dict[str, Any]]:
        by_id = self._songs.map_by_ids(ids)
        return [song_json(by_id[song_id]) for song_id in ids if song_id in by_id]

    def _favorite_genres(self, user_id: str) -> list[str]:
        return (self._users.music_preferences(user_id).get("genres", [])[:5] if self._users else [])

    @staticmethod
    def _recommended_albums(songs: list[dict[str, Any]]) -> list[dict[str, Any]]:
        albums: dict[str, dict[str, Any]] = {}
        for song in songs:
            name = (song.get("album") or "").strip()
            if not name:
                continue
            key = f"{name.casefold()}::{song.get('artist', '').casefold()}"
            albums.setdefault(key, {"title": name, "artist": song.get("artist", ""), "artwork": song.get("artwork"), "songs": []})["songs"].append(song)
        return list(albums.values())[:8]

    def _recently_played(self, user_id: str) -> list[dict[str, Any]]:
        entries = self._library.recent_entries(user_id, limit=_RECENT_LIMIT)
        songs_by_id = self._songs.map_by_ids(e["song_id"] for e in entries)
        return [
            song_json(songs_by_id[e["song_id"]])
            for e in entries
            if e["song_id"] in songs_by_id
        ]

    def _made_for_you(
        self, top_artists: list[dict[str, Any]], recent_songs: list[dict[str, Any]], user_id: str
    ) -> list[dict[str, Any]]:
        raw: list[dict[str, Any]] = []
        for artist in top_artists:
            raw += self._youtube.search(
                f"{artist['artist_norm']} best songs", limit=_PER_ARTIST_SONGS
            )
        # Cold-start: brand-new user with no history at all.
        if not raw and not recent_songs:
            preferences = self._users.music_preferences(user_id) if self._users else {}
            queries = [f"{artist} best songs" for artist in preferences.get("favorite_artists", [])[:3]]
            queries += [f"{genre} best songs" for genre in preferences.get("genres", [])[:3]]
            for query in queries[:3] or ["top hits"]:
                raw += self._youtube.search(query, limit=5)

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
