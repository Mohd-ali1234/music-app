
# Action: file_editor create /app/backend/search_service.py --file-text """"Search: merges local catalog + live YouTube, de-dupes by yt_video_id."""
from __future__ import annotations

import re
import time
import uuid
from datetime import datetime, timezone
from typing import Any

from rapidfuzz import fuzz

from db import get_db
from song_utils import is_valid_song, normalize_artist, normalize_title, song_json
from youtube_client import YouTubeClient


def score_song(query: str, song: dict[str, Any]) -> float:
    """Pure ranking function combining title/artist similarity + popularity."""
    q = (query or "").strip().lower()
    if not q:
        return 0.0
    title = (song.get("title") or "").lower()
    artist = (song.get("artist") or "").lower()
    album = (song.get("album") or "").lower()
    title_sim = fuzz.token_set_ratio(q, title) / 100.0
    artist_sim = fuzz.token_set_ratio(q, artist) / 100.0
    album_sim = fuzz.token_set_ratio(q, album) / 100.0

    # whole-word bonuses
    def whole(needle: str, hay: str) -> bool:
        return re.search(rf"b{re.escape(needle)}b", hay) is not None

    bonus = 0.0
    for tok in q.split():
        if whole(tok, title):
            bonus += 0.08
        elif whole(tok, artist):
            bonus += 0.05
    # popularity signal (only for local rows)
    plays = float(song.get("_global_plays", 0) or 0)
    pop = min(plays, 1000) / 1000.0
    return round(0.55 * title_sim + 0.30 * artist_sim + 0.05 * album_sim + 0.10 * pop + bonus, 4)


def _search_rank(query: str, songs: list[dict]) -> list[dict]:
    return sorted(songs, key=lambda s: score_song(query, s), reverse=True)


def _local_matches(db, query: str, limit: int = 25) -> list[dict]:
    qn = normalize_title(query)
    qa = normalize_artist(query)
    if not qn and not qa:
        return []
    or_clauses = []
    tokens = [t for t in re.split(r"s+", qn) if t]
    if tokens:
        regex = ".*".join(re.escape(t) for t in tokens)
        or_clauses.append({"title_norm": {"$regex": regex}})
        or_clauses.append({"artist_norm": {"$regex": regex}})
        or_clauses.append({"album_norm": {"$regex": regex}})
    if not or_clauses:
        return []
    cur = db.songs.find({"$or": or_clauses}, {"_id": 0}).limit(limit)
    rows = list(cur)
    # attach play counts
    ids = [r["id"] for r in rows]
    if ids:
        agg = db.plays.aggregate([
            {"$match": {"song_id": {"$in": ids}}},
            {"$group": {"_id": "$song_id", "n": {"$sum": 1}}},
        ])
        pop = {a["_id"]: a["n"] for a in agg}
        for r in rows:
            r["_global_plays"] = pop.get(r["id"], 0)
    return rows


def search_songs(
    *,
    query: str,
    user_id: str | None,
    yt: YouTubeClient,
    limit_songs: int = 25,
) -> dict[str, Any]:
    started = time.perf_counter()
    db = get_db()
    q = (query or "").strip()
    if not q:
        return {
            "songs": [], "artists": [], "albums": [],
            "search_id": str(uuid.uuid4()), "search_duration_ms": 0,
        }

    # Search only the YouTube Music song catalog, never the local collection.
    local_rows: list[dict] = []
    yt_rows_raw = yt.search(q, limit=limit_songs)
    # filter YT results
    yt_rows = [
        r for r in yt_rows_raw
        if is_valid_song(r.get("title", ""), r.get("artist", ""), r.get("duration_sec"))
    ]

    # dedupe by yt_video_id — local wins
    seen: set[str] = set()
    merged: list[dict] = []
    for r in local_rows:
        vid = r.get("yt_video_id")
        if vid:
            seen.add(vid)
        merged.append(r)
    for r in yt_rows:
        vid = r.get("yt_video_id")
        if not vid or vid in seen:
            continue
        seen.add(vid)
        merged.append(r)

    ranked = _search_rank(q, merged)[:limit_songs]

    # facets
    artist_map: dict[str, dict] = {}
    album_map: dict[str, dict] = {}
    for r in ranked:
        a = r.get("artist") or ""
        if a and a.lower() not in artist_map:
            artist_map[a.lower()] = {"name": a, "artwork_url": r.get("artwork_url", "")}
        al = r.get("album") or ""
        if al:
            key = f"{a.lower()}|{al.lower()}"
            if key not in album_map:
                album_map[key] = {"name": al, "artist": a, "artwork_url": r.get("artwork_url", "")}

    search_id = str(uuid.uuid4())
    if user_id:
        db.search_history.insert_one({
            "id": search_id,
            "user_id": user_id,
            "query": q,
            "result_count": len(ranked),
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

    return {
        "songs": [song_json(r) for r in ranked],
        "artists": list(artist_map.values())[:10],
        "albums": list(album_map.values())[:10],
        "search_id": search_id,
        "search_duration_ms": int((time.perf_counter() - started) * 1000),
    }
# "
# Observation: Create successful: /app/backend/search_service.py
