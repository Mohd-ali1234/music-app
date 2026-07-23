"""In-session learning: let the last few minutes bend the next few.

The app already learns *slowly* and globally — ``UserStatsRepository`` folds
every listen into long-term preference scores that the recommendation engine
reads. That is the right mechanism for durable taste, and this module does not
touch it.

What it adds is the fast loop: adaptation that lives and dies with a single
session. If you skip three unfamiliar artists in a row right now, the DJ should
pull back on discovery *immediately*, not after tomorrow's aggregate catches up.
Nothing here is persisted as taste, so a bad night never poisons the profile.

Two outputs:

* ``weight_multipliers`` — per-signal multipliers folded into the session's
  :class:`~app.services.recommendation.scoring.ScoringPolicy`.
* ``suppressed_artists`` / ``boosted_artists`` — artist-level verdicts applied
  during queue filtering.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from app.services.dj.context import DJContext

#: An artist needs this net negative score before the DJ stops offering them.
_SUPPRESS_THRESHOLD = 2
#: ...and this net positive score before the DJ leans into them.
_BOOST_THRESHOLD = 2
#: Below this many observations the sample is too small to learn anything.
_MIN_SAMPLE = 3


@dataclass(frozen=True)
class Feedback:
    """What the session has taught the DJ so far."""

    weight_multipliers: dict[str, float] = field(default_factory=dict)
    suppressed_artists: frozenset[str] = frozenset()
    boosted_artists: frozenset[str] = frozenset()
    #: Multiplier applied to the discovery ratio on top of the strategy's own.
    discovery_multiplier: float = 1.0
    #: Human-readable notes, surfaced in the DJ debug/insight payload.
    notes: tuple[str, ...] = ()

    @property
    def is_empty(self) -> bool:
        return not self.weight_multipliers and not self.suppressed_artists


class FeedbackLearner:
    """Derives fast, session-scoped adjustments from observed reactions."""

    def learn(self, ctx: DJContext) -> Feedback:
        observations = ctx.session.observations
        if len(observations) < _MIN_SAMPLE:
            return Feedback()

        rate = ctx.config.learning_aggressiveness
        artist_scores = self._artist_scores(ctx)
        notes: list[str] = []
        multipliers: dict[str, float] = {}

        # --- where are the skips landing: familiar or unfamiliar territory? ---
        familiar = set(ctx.top_artist_norms)
        familiar_skips = sum(
            1 for o in observations if o.is_skip and o.artist_norm in familiar
        )
        unfamiliar_skips = sum(
            1 for o in observations if o.is_skip and o.artist_norm not in familiar
        )
        discovery_multiplier = 1.0

        if unfamiliar_skips >= 2 and unfamiliar_skips > familiar_skips:
            # New music is being rejected — retreat toward known ground.
            discovery_multiplier = 1.0 - 0.35 * rate
            multipliers["similar_artist"] = 1.0 - 0.25 * rate
            multipliers["yt_related"] = 1.0 - 0.3 * rate
            multipliers["same_artist"] = 1.0 + 0.2 * rate
            notes.append("pulling back on unfamiliar artists")
        elif familiar_skips >= 2 and familiar_skips > unfamiliar_skips:
            # The usual suspects are being skipped — the listener wants new.
            discovery_multiplier = 1.0 + 0.4 * rate
            multipliers["similar_artist"] = 1.0 + 0.3 * rate
            multipliers["yt_related"] = 1.0 + 0.25 * rate
            multipliers["same_artist"] = 1.0 - 0.3 * rate
            notes.append("leaning into unfamiliar artists")

        # --- overall reception tunes how hard negative history is weighted ---
        if ctx.skip_rate >= 0.4:
            multipliers["user_avoidance"] = 1.0 + 0.5 * rate
            notes.append("weighting past dislikes more heavily")
        elif ctx.completion_rate >= 0.7:
            multipliers["user_affinity"] = 1.0 + 0.3 * rate
            notes.append("doubling down on proven favourites")

        # --- replays are the strongest positive signal available ---
        if ctx.replay_rate >= 0.2:
            multipliers["liked_song"] = 1.0 + 0.3 * rate

        suppressed = frozenset(
            artist
            for artist, score in artist_scores.items()
            if artist and score <= -_SUPPRESS_THRESHOLD
        )
        boosted = frozenset(
            artist
            for artist, score in artist_scores.items()
            if artist and score >= _BOOST_THRESHOLD
        )
        if suppressed:
            notes.append(f"backing off {len(suppressed)} artist(s)")

        return Feedback(
            weight_multipliers=multipliers,
            suppressed_artists=suppressed,
            boosted_artists=boosted,
            discovery_multiplier=round(max(0.3, min(2.0, discovery_multiplier)), 4),
            notes=tuple(notes),
        )

    @staticmethod
    def _artist_scores(ctx: DJContext) -> dict[str, int]:
        """Net reception per artist: completions reward, skips penalize.

        Skips carry more weight than completions because a skip is an active
        rejection while a completion is often just the absence of an objection.
        """
        scores: dict[str, int] = {}
        for observation in ctx.session.observations:
            artist = observation.artist_norm
            if not artist:
                continue
            if observation.is_skip:
                scores[artist] = scores.get(artist, 0) - 2
            elif observation.is_completion:
                scores[artist] = scores.get(artist, 0) + 1
        return scores
