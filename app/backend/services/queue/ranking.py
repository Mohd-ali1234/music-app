
# Action: file_editor create /app/backend/services/queue/ranking.py --file-text """"Ranking engine: builds a radio queue mixing local + live YouTube tracks.

# Pure logic (no FastAPI); injectable ``db_getter`` and ``youtube_client`` for tests.
# """
from __future__ import annotations

import math
import random
import re
from typing import Any, Callable

from rapidfuzz import fuzz

from song_utils import is_valid_song, normalize_artist, normalize_title, song_json

# --- weights (tunable, kept as class attrs so tests/monkeypatch can override) ---
W_ARTIST_MATCH = 1.0
W_ALBUM_MATCH = 0.7
W_TITLE_SIM = 0.5
W_USER_ARTIST = 0.25   # per log(plays+1)
W_USER_ALBUM = 0.20
W_USER_SONG = 0.15
W_CO_OCCUR = 0.30      # co-occurrence in other users' sessions
W_POPULARITY = 0.10
W_YT_RELATED_BASE = 0.6  # base score for a live YT related track (before jitter)
JITTER = 0.06            # controlled randomness


class RankingEngine:
    def __init__(
        self,
        *,
        db_getter: Callable,
        youtube_client,
        rng_seed: int | None = None,
    ) -> None:
        self._db_getter = db_getter
        self._yt = youtube_client
        self._rng_seed = rng_seed

    # ------------ public ------------
    def rank(
        self, *, seed: dict[str, Any], user_id: str | None, size: int = 25
    ) -> list[dict[str, Any]]:
        db = self._db_getter()
        size = max(5, min(size, 50))
        seed_artist = normalize_artist(seed.get("artist") or seed.get("artist_norm") or "")
        seed_album = normalize_title(seed.get("album") or seed.get("album_norm") or "")
        seed_title = normalize_title(seed.get("title") or seed.get("title_norm") or "")
        seed_vid = seed.get("yt_video_id") or ""

        # Deterministic-ish rng seeded by (user, seed vid) so radios feel stable
        # per-session but different across users/seeds.
        rng = random.Random(self._rng_seed if self._rng_seed is not None
                            else hash(f"{user_id}|{seed_vid}|{seed_title}") & 0xFFFFFFFF)

        # 1) Local candidates
        local_candidates = self._collect_local_candidates(
            db, seed, seed_artist, seed_album, exclude_vid=seed_vid
        )

        # 2) User personalization
        user_signals = self._user_signals(db, user_id) if user_id else _EmptySignals()

        # 3) Co-occurrence from other users' listening sessions
        co_occ = self._co_occurrence(db, seed_vid, seed_artist)

        # 4) Score locals
        scored: list[tuple[float, dict]] = []
        seen_vids: set[str] = {seed_vid} if seed_vid else set()
        for row in local_candidates:
            vid = row.get("yt_video_id")
            if vid and vid in seen_vids:
                continue
            score = self._score_local(row, seed_artist, seed_album, seed_title,
                                      user_signals, co_occ)
            score += rng.uniform(-JITTER, JITTER)
            scored.append((score, row))
            if vid:
                seen_vids.add(vid)

        # 5) Live YouTube — capped to 1-2 outbound calls
        yt_candidates = self._collect_yt_candidates(
            seed, seed_artist, seed_title, exclude_vids=seen_vids
        )
        for i, yt_row in enumerate(yt_candidates):
            vid = yt_row.get("yt_video_id")
            if not vid or vid in seen_vids:
                continue
            seen_vids.add(vid)
            score = W_YT_RELATED_BASE + self._yt_boost(yt_row, seed_artist, seed_title)
            # position decay so first YT results outrank later ones
            score -= 0.01 * i
            score += rng.uniform(-JITTER, JITTER)
            scored.append((score, yt_row))

        scored.sort(key=lambda t: t[0], reverse=True)
        top = [row for _, row in scored[: size]]

        # If we somehow have <5, pad by broadening YT search
        if len(top) < 5 and self._yt:
            extra = self._yt.search(f"{seed.get('artist','')} music", limit=15)
            for r in extra:
                vid = r.get("yt_video_id")
                if not vid or vid in seen_vids:
                    continue
                if not is_valid_song(r.get("title",""), r.get("artist",""), r.get("duration_sec")):
                    continue
                seen_vids.add(vid)
                top.append(r)
                if len(top) >= size:
                    break

        return [song_json(r) for r in top]

    # ------------ internals ------------
    def _collect_local_candidates(self, db, seed, seed_artist, seed_album, exclude_vid):
        out: list[dict] = []
        seen_ids: set[str] = set()
        base_filter: list[dict] = []
        if seed_artist:
            base_filter.append({"artist_norm": seed_artist})
        if seed_album:
            base_filter.append({"album_norm": seed_album})
        if base_filter:
            cur = db.songs.find({"$or": base_filter}, {"_id": 0}).limit(200)
            for r in cur:
                if r.get("yt_video_id") == exclude_vid:
                    continue
                if r["id"] not in seen_ids:
                    seen_ids.add(r["id"])
                    out.append(r)
        # Also fuzzy artist match on similar tokens
        if seed_artist:
            tokens = [t for t in re.split(r"s+", seed_artist) if len(t) > 2]
            if tokens:
                regex = "|".join(re.escape(t) for t in tokens)
                cur = db.songs.find(
                    {"artist_norm": {"$regex": regex}}, {"_id": 0}
                ).limit(200)
                for r in cur:
                    if r["id"] in seen_ids or r.get("yt_video_id") == exclude_vid:
                        continue
                    seen_ids.add(r["id"])
                    out.append(r)
        return out

    def _user_signals(self, db, user_id: str):
        return _UserSignals(
            artist_plays={
                d["artist_norm"]: d.get("play_count", 0)
                for d in db.user_artist_stats.find({"user_id": user_id}, {"_id": 0})
            },
            album_plays={
                d["album_norm"]: d.get("play_count", 0)
                for d in db.user_album_stats.find({"user_id": user_id}, {"_id": 0})
            },
            song_plays={
                d["song_id"]: d.get("play_count", 0)
                for d in db.user_song_stats.find({"user_id": user_id}, {"_id": 0})
            },
        )

    def _co_occurrence(self, db, seed_vid: str, seed_artist: str) -> dict[str, int]:
        """Count how often other tracks appear in sessions with the seed."""
        if not seed_vid and not seed_artist:
            return {}
        match = {}
        if seed_vid:
            match["song_yt_ids"] = seed_vid
        elif seed_artist:
            match["artist_norms"] = seed_artist
        counts: dict[str, int] = {}
        try:
            cur = db.listening_sessions.find(match, {"_id": 0, "song_yt_ids": 1}).limit(500)
            for s in cur:
                for v in s.get("song_yt_ids") or []:
                    if v and v != seed_vid:
                        counts[v] = counts.get(v, 0) + 1
        except Exception:
            pass
        return counts

    def _score_local(self, row, seed_artist, seed_album, seed_title,
                     us: "_UserSignals | _EmptySignals", co_occ) -> float:
        s = 0.0
        row_artist = row.get("artist_norm") or normalize_artist(row.get("artist", ""))
        row_album = row.get("album_norm") or normalize_title(row.get("album", ""))
        row_title = row.get("title_norm") or normalize_title(row.get("title", ""))
        if seed_artist and row_artist == seed_artist:
            s += W_ARTIST_MATCH
        elif seed_artist and row_artist and fuzz.token_set_ratio(seed_artist, row_artist) > 80:
            s += W_ARTIST_MATCH * 0.6
        if seed_album and row_album == seed_album:
            s += W_ALBUM_MATCH
        if seed_title and row_title:
            s += W_TITLE_SIM * (fuzz.token_set_ratio(seed_title, row_title) / 100.0)
        # user signals
        s += W_USER_ARTIST * math.log1p(us.artist_plays.get(row_artist, 0))
        s += W_USER_ALBUM * math.log1p(us.album_plays.get(row_album, 0))
        s += W_USER_SONG * math.log1p(us.song_plays.get(row.get("id", ""), 0))
        # co-occurrence
        vid = row.get("yt_video_id") or ""
        if vid in co_occ:
            s += W_CO_OCCUR * math.log1p(co_occ[vid])
        # popularity fallback
        s += W_POPULARITY * math.log1p(row.get("_global_plays", 0) or 0)
        return s

    def _yt_boost(self, row, seed_artist, seed_title) -> float:
        b = 0.0
        artist = normalize_artist(row.get("artist", ""))
        title = normalize_title(row.get("title", ""))
        if seed_artist and artist and (artist == seed_artist or
                                       fuzz.token_set_ratio(seed_artist, artist) > 80):
            b += 0.5
        if seed_title and title:
            b += 0.2 * (fuzz.token_set_ratio(seed_title, title) / 100.0)
        return b

    def _collect_yt_candidates(self, seed, seed_artist, seed_title, exclude_vids) -> list[dict]:
        """At most 2 outbound yt-dlp calls (cached)."""
        if not self._yt:
            return []
        raw: list[dict] = []
        # Call 1: "<artist> radio" — YT's mix-style query
        artist_display = seed.get("artist") or ""
        if artist_display:
            raw += self._yt.search(f"{artist_display} radio mix", limit=15)
        # Call 2: title fallback (only if we don't have enough)
        if len(raw) < 10:
            title_display = seed.get("title") or ""
            if title_display:
                raw += self._yt.search(f"{artist_display} {title_display}", limit=10)
        out: list[dict] = []
        seen: set[str] = set(exclude_vids)
        for r in raw:
            vid = r.get("yt_video_id")
            if not vid or vid in seen:
                continue
            if not is_valid_song(r.get("title",""), r.get("artist",""), r.get("duration_sec")):
                continue
            seen.add(vid)
            out.append(r)
        return out


class _EmptySignals:
    artist_plays: dict = {}
    album_plays: dict = {}
    song_plays: dict = {}


class _UserSignals:
    def __init__(self, artist_plays, album_plays, song_plays):
        self.artist_plays = artist_plays
        self.album_plays = album_plays
        self.song_plays = song_plays
# "
# Observation: Create successful: /app/backend/services/queue/ranking.py