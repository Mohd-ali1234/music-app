"""Resolve a small list of song queries and persist the resulting playlist."""
from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from typing import Any

from fastapi import HTTPException

from app.domain import song_json
from app.providers import YouTubeClient
from app.repositories import PlaylistRepository
from app.schemas.song import MaterializeIn
from app.services.song_service import SongService

_MAX_SONGS = 15
_SEARCH_WORKERS = 4
_RESULTS_PER_QUERY = 3


class PlaylistCreationService:
    """Build a playable playlist from full song-name queries.

    Searches are deliberately bounded to four concurrent requests.  This keeps
    a 15-track request responsive without sending a burst of requests to
    YouTube Music.  Materialization is then done in input order, so the saved
    playlist preserves the order supplied by the caller.
    """

    def __init__(
        self,
        playlists: PlaylistRepository,
        songs: SongService,
        youtube: YouTubeClient,
    ) -> None:
        self._playlists = playlists
        self._songs = songs
        self._youtube = youtube

    def create_from_searches(
        self,
        *,
        user_id: str,
        name: str,
        description: str,
        song_queries: list[str],
    ) -> dict[str, Any]:
        queries = self._clean_queries(song_queries)
        if not queries:
            raise HTTPException(status_code=422, detail="Provide at least one song query")

        resolved = self._resolve_queries(queries)
        matched_rows: list[tuple[str, dict[str, Any]]] = []
        unmatched: list[str] = []
        seen_video_ids: set[str] = set()
        for query, rows in zip(queries, resolved, strict=True):
            match = next(
                (
                    row
                    for row in rows
                    if row.get("yt_video_id")
                    and row["yt_video_id"] not in seen_video_ids
                ),
                None,
            )
            if match is None:
                unmatched.append(query)
                continue
            seen_video_ids.add(match["yt_video_id"])
            matched_rows.append((query, match))

        if not matched_rows:
            raise HTTPException(status_code=422, detail="None of the supplied songs could be found")

        songs = [self._materialize(user_id, row) for _, row in matched_rows]
        playlist = self._playlists.create(user_id, name, description)
        self._playlists.update_owned(
            playlist["id"], user_id, {"song_ids": [song["id"] for song in songs]}
        )
        playlist["song_ids"] = [song["id"] for song in songs]
        playlist["songs"] = songs
        return {
            "playlist": playlist,
            "matched_queries": [query for query, _ in matched_rows],
            "unmatched_queries": unmatched,
        }

    @staticmethod
    def _clean_queries(song_queries: list[str]) -> list[str]:
        queries: list[str] = []
        seen: set[str] = set()
        for raw in song_queries[:_MAX_SONGS]:
            query = raw.strip()
            key = query.casefold()
            if query and key not in seen:
                queries.append(query)
                seen.add(key)
        return queries

    def _resolve_queries(self, queries: list[str]) -> list[list[dict[str, Any]]]:
        # executor.map keeps the output in the same order as ``queries``.
        with ThreadPoolExecutor(max_workers=_SEARCH_WORKERS) as executor:
            return list(
                executor.map(
                    lambda query: self._youtube.search(query, limit=_RESULTS_PER_QUERY),
                    queries,
                )
            )

    def _materialize(self, user_id: str, row: dict[str, Any]) -> dict[str, Any]:
        result = self._songs.materialize(
            user_id,
            MaterializeIn(
                yt_video_id=row["yt_video_id"],
                title=row.get("title") or "",
                artist=row.get("artist") or "",
                album=row.get("album") or "",
                artwork_url=row.get("artwork_url") or "",
                duration_sec=row.get("duration_sec"),
            ),
        )
        return song_json(result["song"])
