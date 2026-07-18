"""Candidate sources backed by the local catalog (``songs`` collection)."""
from __future__ import annotations

from rapidfuzz import fuzz

from app.services.recommendation.candidates.base import Candidate, CandidateSource
from app.services.recommendation.context import RadioContext
from app.utils.text import normalize_artist

_CANDIDATE_LIMIT = 100
# Above this fuzzy ratio two artist names are treated as the "same" artist.
_SAME_ARTIST_RATIO = 92
# Below this they are unrelated; between the two they count as "similar".
_SIMILAR_ARTIST_FLOOR = 55


class SameArtistSource(CandidateSource):
    """Other tracks by the seed's artist — the backbone of a good radio."""

    name = "same_artist"

    def collect(self, ctx: RadioContext) -> list[Candidate]:
        if not ctx.seed_artist_norm:
            return []
        rows = ctx.songs.find_by_artist_norm(ctx.seed_artist_norm, _CANDIDATE_LIMIT)
        return [
            Candidate(row, {"same_artist": 1.0})
            for row in rows
            if not ctx.is_seed(row)
        ]


class SameAlbumSource(CandidateSource):
    """Tracks from the same album — gives natural album continuity."""

    name = "same_album"

    def collect(self, ctx: RadioContext) -> list[Candidate]:
        if not ctx.seed_album_norm:
            return []
        rows = ctx.songs.find_by_album_norm(ctx.seed_album_norm, _CANDIDATE_LIMIT)
        return [
            Candidate(row, {"same_album": 1.0})
            for row in rows
            if not ctx.is_seed(row)
        ]


class SimilarArtistSource(CandidateSource):
    """Tracks by *different* artists whose names are fuzzily close to the seed's.

    A lightweight local proxy for "similar artists" until a dedicated
    artist-similarity signal (e.g. from co-listening or MusicBrainz relations)
    is added — at which point it simply becomes another candidate source.
    """

    name = "similar_artist"

    def collect(self, ctx: RadioContext) -> list[Candidate]:
        if not ctx.seed_artist_norm:
            return []
        tokens = ctx.seed_artist_norm.split()
        rows = ctx.songs.find_by_fuzzy_artist_tokens(tokens, limit=200)
        candidates: list[Candidate] = []
        for row in rows:
            if ctx.is_seed(row):
                continue
            row_artist = row.get("artist_norm") or normalize_artist(row.get("artist", ""))
            if not row_artist:
                continue
            ratio = fuzz.token_set_ratio(ctx.seed_artist_norm, row_artist)
            if row_artist == ctx.seed_artist_norm or ratio >= _SAME_ARTIST_RATIO:
                continue  # same artist — handled by SameArtistSource
            if ratio < _SIMILAR_ARTIST_FLOOR:
                continue
            candidates.append(Candidate(row, {"similar_artist": ratio / 100.0}))
        return candidates
