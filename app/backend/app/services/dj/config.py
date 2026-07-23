"""Tunable AI DJ behaviour.

Every knob is a normalized ``0.0..1.0`` dial (except ``enabled``), so the DJ can
be re-tuned from the client, from a future A/B experiment, or per session
without touching decision code. Values are clamped on the way in, which means a
malformed or hostile payload degrades to a sane DJ rather than an exception.

The config is deliberately *data only*: it carries no behaviour beyond
validation and (de)serialization. Interpretation lives in the strategy,
optimizer and narration modules that read it.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass, replace
from typing import Any

#: Weight names in :data:`app.services.recommendation.scoring.DEFAULT_WEIGHTS`
#: that the DJ is allowed to re-tune per session. Anything outside this set is
#: left exactly as the recommendation engine defines it, so DJ tuning can never
#: silently redefine the base ranking contract.
TUNABLE_WEIGHTS: frozenset[str] = frozenset({
    "same_artist",
    "same_album",
    "similar_artist",
    "co_occurrence",
    "yt_related",
    "user_affinity",
    "liked_song",
    "user_avoidance",
})


def _clamp(value: Any, low: float = 0.0, high: float = 1.0, default: float = 0.5) -> float:
    """Coerce ``value`` into ``[low, high]``, falling back to ``default``."""
    try:
        number = float(value)
    except (TypeError, ValueError):
        return default
    if number != number:  # NaN
        return default
    return max(low, min(high, number))


@dataclass(frozen=True)
class DJConfig:
    """User-facing DJ preferences.

    Attributes:
        enabled: Master switch. When ``False`` the DJ never alters the queue.
        narration_frequency: How chatty the DJ is. ``0.0`` mutes narration
            entirely; ``1.0`` allows a line at every decision point (still
            subject to the hard cooldown in the narration service).
        discovery_level: Appetite for unfamiliar music. Feeds the radio
            engine's ``discovery_ratio``.
        energy_control: Whether the DJ may deliberately raise or lower the
            energy arc of the queue. When ``False`` ordering ignores energy.
        mood_consistency: How tightly the DJ holds the current vibe. High
            values suppress abrupt changes of direction.
        artist_diversity: How aggressively repeated artists are spread out.
        learning_aggressiveness: How fast in-session feedback (skips, replays)
            moves the scoring weights.
    """

    enabled: bool = True
    narration_frequency: float = 0.35
    discovery_level: float = 0.30
    energy_control: bool = True
    mood_consistency: float = 0.60
    artist_diversity: float = 0.60
    learning_aggressiveness: float = 0.50

    # --- (de)serialization ---
    @classmethod
    def from_document(cls, doc: dict[str, Any] | None) -> "DJConfig":
        """Build a config from a stored/untrusted mapping, clamping every field."""
        if not doc:
            return cls()
        defaults = cls()
        return cls(
            enabled=bool(doc.get("enabled", defaults.enabled)),
            narration_frequency=_clamp(
                doc.get("narration_frequency"), default=defaults.narration_frequency
            ),
            discovery_level=_clamp(
                doc.get("discovery_level"), default=defaults.discovery_level
            ),
            energy_control=bool(doc.get("energy_control", defaults.energy_control)),
            mood_consistency=_clamp(
                doc.get("mood_consistency"), default=defaults.mood_consistency
            ),
            artist_diversity=_clamp(
                doc.get("artist_diversity"), default=defaults.artist_diversity
            ),
            learning_aggressiveness=_clamp(
                doc.get("learning_aggressiveness"),
                default=defaults.learning_aggressiveness,
            ),
        )

    def to_document(self) -> dict[str, Any]:
        return asdict(self)

    def merged_with(self, patch: dict[str, Any] | None) -> "DJConfig":
        """Return a copy with only the supplied (non-``None``) fields replaced."""
        if not patch:
            return self
        supplied = {k: v for k, v in patch.items() if v is not None}
        if not supplied:
            return self
        return DJConfig.from_document({**self.to_document(), **supplied})

    # --- derived values consumed by the DJ pipeline ---
    @property
    def engine_discovery_ratio(self) -> float:
        """Map ``discovery_level`` onto the radio engine's discovery ratio.

        The engine's own default is ``0.18``. We span ``0.08..0.45`` so that
        even a maximally adventurous DJ keeps the queue majority-familiar —
        a queue that is mostly unknown music stops feeling like *your* radio.
        """
        return round(0.08 + self.discovery_level * 0.37, 4)

    @property
    def max_tracks_per_artist(self) -> int:
        """Hard cap on how often one artist may appear in a single queue."""
        # diversity 0.0 -> 6 tracks (album-deep dives allowed)
        # diversity 1.0 -> 2 tracks (rotate constantly)
        return int(round(6 - self.artist_diversity * 4))

    @property
    def min_gap_between_same_artist(self) -> int:
        """Minimum number of tracks between two plays of the same artist."""
        return int(round(1 + self.artist_diversity * 4))

    def signal_weight_overrides(self, *, energy_bias: float = 0.0) -> dict[str, float]:
        """Per-session multipliers applied on top of the engine's base weights.

        Returns a sparse mapping of ``signal -> multiplier``. Only signals in
        :data:`TUNABLE_WEIGHTS` are ever returned. ``energy_bias`` is the
        strategy's requested energy shift in ``-1.0..1.0``; it nudges how much
        the DJ leans on safe/familiar signals versus exploratory ones.
        """
        familiar_pull = 0.7 + self.mood_consistency * 0.6      # 0.70 .. 1.30
        explore_pull = 0.6 + self.discovery_level * 0.9        # 0.60 .. 1.50
        # Raising energy favours adjacent-but-new material; cooling down leans
        # back on the comfort of known favourites.
        explore_pull *= 1.0 + max(0.0, energy_bias) * 0.25
        familiar_pull *= 1.0 + max(0.0, -energy_bias) * 0.25
        return {
            "same_artist": familiar_pull,
            "same_album": familiar_pull,
            "similar_artist": explore_pull,
            "co_occurrence": explore_pull,
            "yt_related": explore_pull,
            "user_affinity": 0.8 + self.learning_aggressiveness * 0.8,
            "liked_song": familiar_pull,
            "user_avoidance": 0.8 + self.learning_aggressiveness * 1.2,
        }

    def with_enabled(self, enabled: bool) -> "DJConfig":
        return replace(self, enabled=enabled)


#: The config applied when a user has never touched DJ settings.
DEFAULT_CONFIG = DJConfig()
