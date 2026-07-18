"""Search use-case: query YouTube Music, enrich, rank, and shape the response.

The response envelope is byte-compatible with the previous implementation:
``{songs, artists, albums, search_id, search_duration_ms}``. Only the ordering
of ``songs`` changes (improved relevance) plus popularity-aware ranking.
"""
from __future__ import annotations

import time
import uuid
from typing import Any

from app.domain import song_json
from app.providers import YouTubeClient
from app.repositories import (
    PlaysRepository,
    SearchHistoryRepository,
    SongRepository,
)
from app.services.search.ranker import SearchRanker
from app.utils.text import is_valid_song

_DEFAULT_LIMIT = 25
_MAX_FACETS = 10


class SearchService:
    def __init__(
        self,
        songs: SongRepository,
        plays: PlaysRepository,
        history: SearchHistoryRepository,
        youtube: YouTubeClient,
        ranker: SearchRanker | None = None,
    ) -> None:
        self._songs = songs
        self._plays = plays
        self._history = history
        self._youtube = youtube
        self._ranker = ranker or SearchRanker()

    def search(
        self, query: str, user_id: str | None, limit: int = _DEFAULT_LIMIT
    ) -> dict[str, Any]:
        started = time.perf_counter()
        cleaned = (query or "").strip()
        if not cleaned:
            return self._empty_response()

        candidates = self._retrieve_candidates(cleaned, limit)
        self._attach_popularity(candidates)
        ranked = self._ranker.rank(cleaned, candidates)[:limit]

        search_id = str(uuid.uuid4())
        if user_id:
            self._history.record(search_id, user_id, cleaned, len(ranked))

        return {
            "songs": [song_json(row) for row in ranked],
            "artists": self._artist_facets(ranked),
            "albums": self._album_facets(ranked),
            "search_id": search_id,
            "search_duration_ms": int((time.perf_counter() - started) * 1000),
        }

    # --- retrieval ---
    def _retrieve_candidates(self, query: str, limit: int) -> list[dict[str, Any]]:
        raw = self._youtube.search(query, limit=limit)
        seen: set[str] = set()
        candidates: list[dict[str, Any]] = []
        for row in raw:
            if not is_valid_song(
                row.get("title", ""), row.get("artist", ""), row.get("duration_sec")
            ):
                continue
            vid = row.get("yt_video_id")
            if not vid or vid in seen:
                continue
            seen.add(vid)
            candidates.append(row)
        return candidates

    def _attach_popularity(self, candidates: list[dict[str, Any]]) -> None:
        """Enrich candidates with global + artist play counts (2 bulk queries).

        Displayed identity (``id``/``yt_video_id``) is unchanged — only hidden
        ``_global_plays`` / ``_artist_plays`` signals are attached for ranking.
        """
        yt_ids = [c.get("yt_video_id") for c in candidates if c.get("yt_video_id")]
        local_rows = self._songs.list_by_yt_video_ids(yt_ids)
        if not local_rows:
            return

        by_yt = {row["yt_video_id"]: row for row in local_rows if row.get("yt_video_id")}
        play_counts = self._plays.play_counts_by_song(
            [row["id"] for row in local_rows if row.get("id")]
        )

        # Aggregate popularity per normalized artist across known local tracks.
        artist_plays: dict[str, int] = {}
        for row in local_rows:
            artist_norm = row.get("artist_norm") or ""
            artist_plays[artist_norm] = artist_plays.get(artist_norm, 0) + play_counts.get(
                row.get("id", ""), 0
            )

        for cand in candidates:
            local = by_yt.get(cand.get("yt_video_id"))
            if not local:
                continue
            cand["_global_plays"] = play_counts.get(local.get("id", ""), 0)
            cand["_artist_plays"] = artist_plays.get(local.get("artist_norm") or "", 0)

    # --- facets (unchanged shape) ---
    @staticmethod
    def _artist_facets(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
        facets: dict[str, dict[str, Any]] = {}
        for row in rows:
            artist = row.get("artist") or ""
            key = artist.lower()
            if artist and key not in facets:
                facets[key] = {"name": artist, "artwork_url": row.get("artwork_url", "")}
        return list(facets.values())[:_MAX_FACETS]

    @staticmethod
    def _album_facets(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
        facets: dict[str, dict[str, Any]] = {}
        for row in rows:
            artist = row.get("artist") or ""
            album = row.get("album") or ""
            if not album:
                continue
            key = f"{artist.lower()}|{album.lower()}"
            if key not in facets:
                facets[key] = {
                    "name": album,
                    "artist": artist,
                    "artwork_url": row.get("artwork_url", ""),
                }
        return list(facets.values())[:_MAX_FACETS]

    @staticmethod
    def _empty_response() -> dict[str, Any]:
        return {
            "songs": [],
            "artists": [],
            "albums": [],
            "search_id": str(uuid.uuid4()),
            "search_duration_ms": 0,
        }
