"""The radio engine: merge candidates, personalize, score, curate a flow.

Guarantees:
* The seed track is always first and never duplicated.
* No duplicate recommendations (deduped by local id / external video id).
* No purely-random tracks — every candidate is tied to the seed by an explicit
  signal (random ``$sample`` discovery has been removed).
* Familiarity vs. discovery is balanced by ``discovery_ratio``.
* Same-artist tracks lead; the tail is artist-diversified for a smooth flow.
* A source raising an exception never breaks queue generation.
"""
from __future__ import annotations

import logging
import math
from typing import Any

from app.domain import song_json
from app.services.recommendation.candidates import DEFAULT_SOURCES, Candidate, CandidateSource
from app.services.recommendation.context import RadioContext
from app.services.recommendation.scoring import FAMILIAR_SIGNALS, ScoringPolicy
from app.utils.text import is_valid_song, normalize_artist, normalize_title

log = logging.getLogger(__name__)

_PERSONALIZATION_SATURATION = 50.0
_INTRO_SAME_ARTIST = 2


def _saturate(value: float) -> float:
    if value <= 0:
        return 0.0
    return min(math.log1p(value) / math.log1p(_PERSONALIZATION_SATURATION), 1.0)


class RadioEngine:
    def __init__(
        self,
        sources: list[CandidateSource] | None = None,
        policy: ScoringPolicy | None = None,
        discovery_ratio: float = 0.18,
    ) -> None:
        self._sources = sources if sources is not None else DEFAULT_SOURCES
        self._policy = policy or ScoringPolicy()
        self._discovery_ratio = discovery_ratio

    def build(self, ctx: RadioContext, size: int) -> list[dict[str, Any]]:
        """Return a curated queue as wire-format songs, seed first."""
        target = max(0, size - 1)
        candidates = self._collect(ctx)
        if ctx.user_id:
            self._personalize(ctx, candidates)
        for candidate in candidates:
            candidate.score = self._policy.score(candidate)
        candidates.sort(key=lambda c: (-c.score, c.key or ""))

        selected = self._layout(candidates, target)
        if len(selected) < target:
            self._pad_with_youtube(ctx, selected, target)

        queue = [song_json(ctx.seed)]
        queue.extend(song_json(c.song) for c in selected[:target])
        return queue

    # --- collection & merge ---
    def _collect(self, ctx: RadioContext) -> list[Candidate]:
        merged: dict[str, Candidate] = {}
        for source in self._sources:
            try:
                produced = source.collect(ctx)
            except Exception:  # noqa: BLE001 - a bad source must not break radio
                log.warning("candidate source %s failed", source.name, exc_info=True)
                continue
            for candidate in produced:
                key = candidate.key
                if not key or ctx.is_seed(candidate.song):
                    continue
                existing = merged.get(key)
                if existing is None:
                    merged[key] = candidate
                else:
                    # Keep the strongest evidence for each signal.
                    for signal, value in candidate.signals.items():
                        existing.signals[signal] = max(
                            existing.signals.get(signal, 0.0), value
                        )
        return list(merged.values())

    # --- personalization ---
    def _personalize(self, ctx: RadioContext, candidates: list[Candidate]) -> None:
        try:
            artist_scores = ctx.stats.artist_preference_map(ctx.user_id)  # type: ignore[arg-type]
            album_scores = ctx.stats.album_preference_map(ctx.user_id)  # type: ignore[arg-type]
            song_scores = ctx.stats.song_preference_map(ctx.user_id)  # type: ignore[arg-type]
        except Exception:  # noqa: BLE001
            log.warning("personalization signals unavailable", exc_info=True)
            return
        if not (artist_scores or album_scores or song_scores):
            return
        for candidate in candidates:
            song = candidate.song
            artist = song.get("artist_norm") or normalize_artist(song.get("artist", ""))
            album = song.get("album_norm") or normalize_title(song.get("album", ""))
            preference = (
                0.5 * artist_scores.get(artist, 0)
                + 0.3 * album_scores.get(album, 0)
                + 0.2 * song_scores.get(song.get("id", ""), 0)
            )
            if preference > 0:
                candidate.signals["user_affinity"] = _saturate(preference)
            elif preference < 0:
                candidate.signals["user_avoidance"] = _saturate(-preference)

    # --- curated layout ---
    def _layout(self, candidates: list[Candidate], target: int) -> list[Candidate]:
        if target <= 0:
            return []
        familiar = [c for c in candidates if self._is_familiar(c)]
        discovery = [c for c in candidates if not self._is_familiar(c)]

        discovery_target = (
            min(max(1, round(target * self._discovery_ratio)), target)
            if discovery
            else 0
        )
        familiar_target = target - discovery_target

        familiar_pick = self._order_familiar(familiar, familiar_target)
        discovery_pick = discovery[:discovery_target]
        result = self._splice(familiar_pick, discovery_pick)

        # Backfill if either pool was short, preserving global score order.
        if len(result) < target:
            chosen = {id(c) for c in result}
            for candidate in candidates:
                if len(result) >= target:
                    break
                if id(candidate) not in chosen:
                    result.append(candidate)
                    chosen.add(id(candidate))
        return result[:target]

    @staticmethod
    def _is_familiar(candidate: Candidate) -> bool:
        return any(signal in FAMILIAR_SIGNALS for signal in candidate.signals)

    def _order_familiar(
        self, familiar: list[Candidate], target: int
    ) -> list[Candidate]:
        """Lead with the strongest same-artist tracks, then diversify the tail."""
        if target <= 0:
            return []
        intro_len = min(_INTRO_SAME_ARTIST, target)
        intro = familiar[:intro_len]
        tail = self._diversify(familiar[intro_len:], target - intro_len)
        return intro + tail

    @staticmethod
    def _diversify(candidates: list[Candidate], count: int) -> list[Candidate]:
        """Greedy selection avoiding two identical artists back-to-back."""
        result: list[Candidate] = []
        pool = list(candidates)
        while pool and len(result) < count:
            prev_artist = (
                result[-1].song.get("artist", "").casefold() if result else None
            )
            pick = next(
                (c for c in pool if c.song.get("artist", "").casefold() != prev_artist),
                pool[0],
            )
            result.append(pick)
            pool.remove(pick)
        return result

    @staticmethod
    def _splice(base: list[Candidate], extras: list[Candidate]) -> list[Candidate]:
        """Distribute discovery ``extras`` evenly through the ``base`` list."""
        if not extras:
            return list(base)
        result = list(base)
        for i, extra in enumerate(extras, start=1):
            position = min(len(result), round(i * len(result) / (len(extras) + 1)))
            result.insert(position, extra)
        return result

    # --- fallback padding ---
    def _pad_with_youtube(
        self, ctx: RadioContext, selected: list[Candidate], target: int
    ) -> None:
        if not ctx.youtube or not ctx.seed_artist_display:
            return
        seen_vids = {ctx.seed_yt_id}
        for candidate in selected:
            vid = candidate.song.get("yt_video_id")
            if vid:
                seen_vids.add(vid)
        try:
            extra = ctx.youtube.search(f"{ctx.seed_artist_display} music", limit=15)
        except Exception:  # noqa: BLE001
            return
        for row in extra:
            if len(selected) >= target:
                break
            vid = row.get("yt_video_id")
            if not vid or vid in seen_vids:
                continue
            if not is_valid_song(
                row.get("title", ""), row.get("artist", ""), row.get("duration_sec")
            ):
                continue
            seen_vids.add(vid)
            selected.append(Candidate(row, {"yt_related": 0.3}))
