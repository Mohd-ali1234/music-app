"""Co-occurrence source: tracks that real listeners play alongside the seed."""
from __future__ import annotations

from app.services.recommendation.candidates.base import Candidate, CandidateSource
from app.services.recommendation.context import RadioContext


class CoOccurrenceSource(CandidateSource):
    """Collaborative signal from other users' listening sessions.

    Resolves co-occurring YouTube ids to local catalog rows (so we have real
    metadata) and weights them by how frequently they share a session with the
    seed. This is where "people who listen to X also listen to Y" comes from.
    """

    name = "co_occurrence"

    def collect(self, ctx: RadioContext) -> list[Candidate]:
        counts = ctx.analytics.co_occurring_yt_ids(
            ctx.seed_yt_id, ctx.seed_artist_norm
        )
        if not counts:
            return []
        rows = ctx.songs.list_by_yt_video_ids(counts.keys())
        if not rows:
            return []
        peak = max(counts.values()) or 1
        candidates: list[Candidate] = []
        for row in rows:
            if ctx.is_seed(row):
                continue
            count = counts.get(row.get("yt_video_id") or "", 0)
            if count <= 0:
                continue
            candidates.append(Candidate(row, {"co_occurrence": count / peak}))
        return candidates
