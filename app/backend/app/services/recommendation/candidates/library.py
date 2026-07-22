"""Personal candidates from tracks the listener has explicitly liked."""
from __future__ import annotations
from app.services.recommendation.candidates.base import Candidate, CandidateSource
from app.services.recommendation.context import RadioContext

class LikedSongsSource(CandidateSource):
    name = "liked_songs"
    def collect(self, ctx: RadioContext) -> list[Candidate]:
        if not ctx.user_id:
            return []
        rows = ctx.songs.list_by_ids(ctx.library.liked_song_ids(ctx.user_id))
        return [Candidate(row, {"liked_song": 1.0}) for row in rows if not ctx.is_seed(row)]
