"""The DJ's decision rules — deterministic, ordered, and cheap.

This is where "what should happen next" is decided. It is intentionally plain
Python: no LLM call, no network, no database. Given the same
:class:`~app.services.dj.context.DJContext` it always returns the same
:class:`DJDecision`, which makes DJ behaviour reproducible and debuggable.

Rules are evaluated in strict priority order and the first match wins. Order
matters and encodes real DJ instinct: *reacting to visible rejection always
outranks any longer-term plan*. An LLM is never consulted here; it is used only
downstream for phrasing narration and long-horizon summaries.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable, Literal

from app.services.dj.context import DJContext

#: What the DJ has decided to do with the session right now.
DJIntent = Literal[
    "warm_up",      # session just started — establish the vibe
    "hold_vibe",    # it's working; change as little as possible
    "deepen",       # lean further into what's landing
    "pivot",        # the listener is rejecting this direction; change course
    "refresh",      # one artist is dominating; rotate in new names
    "lift_energy",  # raise the arc
    "cool_down",    # lower the arc
    "rediscover",   # resurface loved tracks that have gone quiet
]

#: Minimum tracks between routine (non-reactive) queue rebuilds. Reactive
#: intents bypass this — a listener skipping repeatedly should not wait.
ROUTINE_REFRESH_INTERVAL = 5

#: A session past this length has earned a deliberate shift in shape.
LONG_SESSION_MINUTES = 45


@dataclass(frozen=True)
class DJDecision:
    """The DJ's decision for one cycle of the loop."""

    intent: DJIntent
    #: Short machine-readable justification; also seeds narration.
    reason: str
    #: Requested energy shift, ``-1.0`` (much calmer) to ``1.0`` (much harder).
    energy_bias: float
    #: Multiplier applied to the configured discovery ratio.
    discovery_bias: float
    #: Whether the upcoming queue should be rebuilt now.
    should_refresh_queue: bool
    #: Whether this decision is interesting enough to be worth speaking about.
    narration_worthy: bool

    def to_document(self, *, at_track: int) -> dict[str, Any]:
        return {
            "intent": self.intent,
            "reason": self.reason,
            "energy_bias": self.energy_bias,
            "discovery_bias": self.discovery_bias,
            "at_track": at_track,
        }


#: A rule is a predicate plus the decision it produces.
_Rule = tuple[str, Callable[[DJContext], bool], Callable[[DJContext], DJDecision]]


def _decision(
    intent: DJIntent,
    reason: str,
    *,
    energy: float = 0.0,
    discovery: float = 1.0,
    refresh: bool = False,
    narrate: bool = False,
) -> DJDecision:
    return DJDecision(
        intent=intent,
        reason=reason,
        energy_bias=max(-1.0, min(1.0, energy)),
        discovery_bias=max(0.2, min(2.5, discovery)),
        should_refresh_queue=refresh,
        narration_worthy=narrate,
    )


class StrategyManager:
    """Chooses one :class:`DJDecision` per cycle from an ordered rule set."""

    def decide(self, ctx: DJContext) -> DJDecision:
        for _, matches, build in self._rules():
            if matches(ctx):
                return build(ctx)
        return _decision("hold_vibe", "steady_state")

    # --- rules, highest priority first ---
    def _rules(self) -> list[_Rule]:
        return [
            (
                # Three rejections in a row is an unambiguous "not this".
                "hard_pivot",
                lambda c: c.skip_streak >= 3,
                lambda c: _decision(
                    "pivot",
                    "repeated_skips",
                    energy=-0.15 if c.current_energy > 0.65 else 0.15,
                    discovery=1.6,
                    refresh=True,
                    narrate=True,
                ),
            ),
            (
                # Softer rejection: correct course without abandoning the vibe.
                "soft_pivot",
                lambda c: c.is_rejecting,
                lambda c: _decision(
                    "pivot",
                    "elevated_skip_rate",
                    energy=0.0,
                    discovery=1.35,
                    refresh=True,
                    narrate=False,
                ),
            ),
            (
                # One artist has taken over; a DJ would rotate.
                "break_saturation",
                lambda c: c.is_saturated,
                lambda c: _decision(
                    "refresh",
                    "artist_saturation",
                    discovery=1.3,
                    refresh=True,
                    narrate=True,
                ),
            ),
            (
                # Late night, or a long session: bring it down gently.
                "wind_down",
                lambda c: c.config.energy_control
                and c.time_of_day == "night"
                and c.tracks_played >= 4,
                lambda c: _decision(
                    "cool_down",
                    "late_night",
                    energy=-0.5,
                    discovery=0.85,
                    refresh=_due_for_routine_refresh(c),
                    narrate=True,
                ),
            ),
            (
                "long_session_cooldown",
                lambda c: c.config.energy_control
                and c.elapsed_minutes >= LONG_SESSION_MINUTES
                and c.current_energy > 0.6,
                lambda c: _decision(
                    "cool_down",
                    "long_session",
                    energy=-0.3,
                    refresh=_due_for_routine_refresh(c),
                    narrate=True,
                ),
            ),
            (
                # Morning with a warm reception: build the arc upward.
                "morning_lift",
                lambda c: c.config.energy_control
                and c.time_of_day == "morning"
                and c.current_energy < 0.45
                and c.completion_rate >= 0.5
                and c.tracks_played >= 3,
                lambda c: _decision(
                    "lift_energy",
                    "morning_lift",
                    energy=0.4,
                    refresh=_due_for_routine_refresh(c),
                    narrate=True,
                ),
            ),
            (
                # Replays mean the listener is savouring specific tracks.
                "rediscover",
                lambda c: c.replay_rate >= 0.25 and c.tracks_played >= 4,
                lambda c: _decision(
                    "rediscover",
                    "high_replay",
                    discovery=0.7,
                    refresh=_due_for_routine_refresh(c),
                    narrate=True,
                ),
            ),
            (
                # Fully engaged: the best thing a DJ can do is nothing.
                "hold",
                lambda c: c.is_locked_in,
                lambda c: _decision(
                    "hold_vibe",
                    "high_engagement",
                    discovery=0.85,
                    refresh=_due_for_routine_refresh(c),
                    narrate=False,
                ),
            ),
            (
                "warm_up",
                lambda c: c.is_warmup,
                lambda c: _decision(
                    "warm_up",
                    "session_start",
                    discovery=0.9,
                    refresh=c.session.queue_version == 0,
                    narrate=c.returning_after_break,
                ),
            ),
            (
                # Steady but unremarkable: deepen into what is working.
                "deepen",
                lambda c: c.completion_rate >= 0.5,
                lambda c: _decision(
                    "deepen",
                    "steady_engagement",
                    discovery=0.9,
                    refresh=_due_for_routine_refresh(c),
                    narrate=False,
                ),
            ),
        ]


def _due_for_routine_refresh(ctx: DJContext) -> bool:
    """True when enough tracks have passed since the last queue rebuild."""
    strategy = ctx.session.strategy or {}
    last_track = int(strategy.get("at_track") or 0)
    return (ctx.tracks_played - last_track) >= ROUTINE_REFRESH_INTERVAL
