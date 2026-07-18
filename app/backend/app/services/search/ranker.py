"""Relevance ranking for search results.

Design goals (to feel like YouTube Music / Spotify / Apple Music):

* Exact title matches rank highest.
* Popularity (global play count) and artist popularity matter.
* Relevance combines fuzzy + partial + whole-word matching, so typos and
  partial queries still surface the right track.
* The provider's own ordering (YouTube Music already sorts by relevance +
  popularity) is used as a prior and as a stable tie-breaker.
* Duplicate song names are ranked intelligently: among near-identical titles,
  the more complete / more popular / better-ranked entry wins.

The scoring is a transparent weighted sum of independent, normalized signals,
so new signals can be added by dropping a term into :meth:`score`.
"""
from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any

from rapidfuzz import fuzz

from app.utils.text import normalize_title, whole_word_hit


@dataclass(frozen=True)
class RankingWeights:
    exact_title: float = 1.00        # normalized title == query
    title_prefix: float = 0.25       # title starts with the query
    title_similarity: float = 0.55   # fuzzy title match
    artist_similarity: float = 0.30  # fuzzy artist match
    album_similarity: float = 0.05   # fuzzy album match
    whole_word_title: float = 0.08   # per query token appearing whole in title
    whole_word_artist: float = 0.05  # per query token appearing whole in artist
    popularity: float = 0.15         # log-scaled global play count
    artist_popularity: float = 0.10  # log-scaled artist play count
    provider_prior: float = 0.12     # trust in provider's original ordering
    completeness: float = 0.03       # has album metadata (tie-breaker nudge)


# Plays beyond this contribute diminishing returns (log saturation point).
_POPULARITY_SATURATION = 1000.0


class SearchRanker:
    def __init__(self, weights: RankingWeights | None = None) -> None:
        self._w = weights or RankingWeights()

    def rank(self, query: str, candidates: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Return ``candidates`` sorted best-first for ``query`` (stable)."""
        query_norm = normalize_title(query)
        if not query_norm:
            return list(candidates)
        query_tokens = query_norm.split()
        scored = [
            (self.score(query_norm, query_tokens, cand, position), position, cand)
            for position, cand in enumerate(candidates)
        ]
        # Sort by score desc; ties fall back to the provider's original order.
        scored.sort(key=lambda item: (-item[0], item[1]))
        return [cand for _, _, cand in scored]

    def score(
        self,
        query_norm: str,
        query_tokens: list[str],
        candidate: dict[str, Any],
        position: int,
    ) -> float:
        w = self._w
        title = (candidate.get("title") or "").lower()
        artist = (candidate.get("artist") or "").lower()
        album = (candidate.get("album") or "").lower()
        title_norm = normalize_title(candidate.get("title") or "")

        score = 0.0

        # --- exact / prefix title ---
        if title_norm and title_norm == query_norm:
            score += w.exact_title
        elif title_norm.startswith(query_norm):
            score += w.title_prefix

        # --- fuzzy relevance (blend token-set with partial for substrings) ---
        score += w.title_similarity * self._fuzzy(query_norm, title)
        score += w.artist_similarity * self._fuzzy(query_norm, artist)
        if album:
            score += w.album_similarity * self._fuzzy(query_norm, album)

        # --- whole-word token bonuses ---
        for token in query_tokens:
            if whole_word_hit(token, title):
                score += w.whole_word_title
            elif whole_word_hit(token, artist):
                score += w.whole_word_artist

        # --- popularity signals (0 for purely external tracks) ---
        plays = float(candidate.get("_global_plays", 0) or 0)
        score += w.popularity * self._saturate(plays)
        artist_plays = float(candidate.get("_artist_plays", 0) or 0)
        score += w.artist_popularity * self._saturate(artist_plays)

        # --- provider prior + completeness (tie-breakers / duplicate handling) ---
        score += w.provider_prior * max(0.0, 1.0 - position * 0.03)
        if album:
            score += w.completeness

        return round(score, 5)

    @staticmethod
    def _fuzzy(query: str, text: str) -> float:
        if not query or not text:
            return 0.0
        token_set = fuzz.token_set_ratio(query, text)
        partial = fuzz.partial_ratio(query, text)
        return max(token_set, partial) / 100.0

    @staticmethod
    def _saturate(value: float) -> float:
        """Log-scale a count into [0, 1] with saturation."""
        if value <= 0:
            return 0.0
        return min(math.log1p(value) / math.log1p(_POPULARITY_SATURATION), 1.0)
