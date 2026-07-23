"""Translate DJ intent into the recommendation engine's native controls.

This module is the seam between the DJ and the existing radio engine, and it is
deliberately the *only* place that knows about both. The engine already accepts
a :class:`~app.services.recommendation.scoring.ScoringPolicy` and a
``discovery_ratio`` through its constructor, so the DJ steers it by supplying
tuned values — it never forks, patches or bypasses engine logic.

Two safety properties matter here:

* Only signals listed in :data:`~app.services.dj.config.TUNABLE_WEIGHTS` may be
  altered. Every other weight passes through exactly as the engine defines it,
  so DJ tuning can never silently redefine base ranking.
* Multipliers are clamped, and negative weights (``user_avoidance``) keep their
  sign. Amplifying a penalty must make it more negative, not flip it positive.
"""
from __future__ import annotations

from app.services.dj.config import TUNABLE_WEIGHTS, DJConfig
from app.services.dj.feedback import Feedback
from app.services.dj.strategy import DJDecision
from app.services.recommendation.scoring import DEFAULT_WEIGHTS, ScoringPolicy

#: A single signal's weight may never move further than this from its default.
_MAX_MULTIPLIER = 2.0
_MIN_MULTIPLIER = 0.25

#: Absolute bounds on the discovery ratio handed to the engine.
_MIN_DISCOVERY = 0.05
_MAX_DISCOVERY = 0.55


def build_policy(
    config: DJConfig, decision: DJDecision, feedback: Feedback
) -> ScoringPolicy:
    """Compose a session-specific :class:`ScoringPolicy`.

    The two multiplier sources compound: ``config`` expresses the listener's
    standing preferences, ``feedback`` expresses what the last few minutes
    taught the DJ.
    """
    weights = dict(DEFAULT_WEIGHTS)
    from_config = config.signal_weight_overrides(energy_bias=decision.energy_bias)

    for signal in TUNABLE_WEIGHTS:
        base = weights.get(signal)
        if base is None:
            continue
        multiplier = from_config.get(signal, 1.0) * feedback.weight_multipliers.get(
            signal, 1.0
        )
        multiplier = max(_MIN_MULTIPLIER, min(_MAX_MULTIPLIER, multiplier))
        # abs() on the multiplier keeps a penalty a penalty: scaling
        # ``user_avoidance`` (-0.55) must never produce a positive weight.
        weights[signal] = round(base * abs(multiplier), 5)

    return ScoringPolicy(weights=weights)


def build_discovery_ratio(
    config: DJConfig, decision: DJDecision, feedback: Feedback
) -> float:
    """Compose the engine's ``discovery_ratio`` for this cycle."""
    ratio = (
        config.engine_discovery_ratio
        * decision.discovery_bias
        * feedback.discovery_multiplier
    )
    return round(max(_MIN_DISCOVERY, min(_MAX_DISCOVERY, ratio)), 4)
