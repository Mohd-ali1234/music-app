"""Scoring policy: turn a candidate's named signals into a single score.

The score is a transparent weighted sum. Signals a candidate doesn't carry
contribute nothing. To introduce a new signal, add its weight here and emit it
from a source or enrichment step — no other code changes required.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from app.services.recommendation.candidates.base import Candidate

# Signals that mean "this track is genuinely related to the seed" (vs. pure
# discovery). Used by the engine to balance familiarity against discovery.
FAMILIAR_SIGNALS: frozenset[str] = frozenset({
    "same_artist", "same_album", "similar_artist", "co_occurrence", "user_affinity", "liked_song",
})

DEFAULT_WEIGHTS: dict[str, float] = {
    "same_artist": 1.00,       # other tracks by the same artist
    "same_album": 0.80,        # album continuity
    "co_occurrence": 0.60,     # collaborative "listened together"
    "similar_artist": 0.55,    # nearby artists
    "yt_related": 0.45,        # YouTube radio-mix relatedness (genre/mood proxy)
    "user_affinity": 0.35,     # strong completion / preference history
    "liked_song": 0.42,        # explicit user signal, balanced with discovery
    "user_avoidance": -0.55,   # repeated quick skips lower this candidate
    "title_affinity": 0.15,    # soft title similarity nudge
    "popularity": 0.15,        # global play-count (reserved for future use)
}


@dataclass(frozen=True)
class ScoringPolicy:
    weights: dict[str, float] = field(default_factory=lambda: dict(DEFAULT_WEIGHTS))

    def score(self, candidate: Candidate) -> float:
        return round(
            sum(
                self.weights.get(signal, 0.0) * value
                for signal, value in candidate.signals.items()
            ),
            5,
        )
