"""YouTube "radio mix" source: live similar / genre / mood discovery.

YouTube Music's mix queries are already genre-, mood-, and popularity-aware, so
they serve as a strong proxy for "same genre / same mood / similar popularity"
without us maintaining those attributes locally. Results are capped to at most
two cached outbound calls per queue build.
"""
from __future__ import annotations

from rapidfuzz import fuzz

from app.services.recommendation.candidates.base import Candidate, CandidateSource
from app.services.recommendation.context import RadioContext
from app.utils.text import is_valid_song, normalize_artist, normalize_title

_SAME_ARTIST_RATIO = 92
_SIMILAR_ARTIST_FLOOR = 55


class YouTubeRadioSource(CandidateSource):
    name = "youtube_radio"

    def collect(self, ctx: RadioContext) -> list[Candidate]:
        if not ctx.youtube or not ctx.seed_artist_display:
            return []

        raw = ctx.youtube.search(f"{ctx.seed_artist_display} radio mix", limit=15)
        if len(raw) < 10 and ctx.seed_title_display:
            raw += ctx.youtube.search(
                f"{ctx.seed_artist_display} {ctx.seed_title_display}", limit=10
            )

        candidates: list[Candidate] = []
        seen: set[str] = set()
        for position, row in enumerate(raw):
            vid = row.get("yt_video_id")
            if not vid or vid in seen or vid == ctx.seed_yt_id:
                continue
            if not is_valid_song(
                row.get("title", ""), row.get("artist", ""), row.get("duration_sec")
            ):
                continue
            seen.add(vid)
            candidates.append(Candidate(row, self._signals(ctx, row, position)))
        return candidates

    @staticmethod
    def _signals(ctx: RadioContext, row: dict, position: int) -> dict[str, float]:
        # Earlier results are more relevant; decay but keep a floor.
        signals: dict[str, float] = {"yt_related": max(0.4, 1.0 - position * 0.03)}

        artist = normalize_artist(row.get("artist", ""))
        if ctx.seed_artist_norm and artist:
            ratio = fuzz.token_set_ratio(ctx.seed_artist_norm, artist)
            if ratio >= _SAME_ARTIST_RATIO:
                signals["same_artist"] = 0.6  # YT-sourced same artist
            elif ratio >= _SIMILAR_ARTIST_FLOOR:
                signals["similar_artist"] = (ratio / 100.0) * 0.8

        title = normalize_title(row.get("title", ""))
        if ctx.seed_title_norm and title:
            signals["title_affinity"] = (
                fuzz.token_set_ratio(ctx.seed_title_norm, title) / 100.0
            ) * 0.2
        return signals
