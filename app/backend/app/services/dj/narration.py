"""What the DJ says, and — more importantly — when it stays quiet.

Narration is the feature most likely to make the DJ feel cheap, so the defaults
are conservative:

* **Never on the hot path.** Every line here is produced from a template with
  no I/O. Queue generation never waits on a language model. Richer, model-
  written commentary lives in :mod:`~app.services.dj.insights`, behind its own
  endpoint the client calls when it is idle.
* **Rate limited twice.** A line requires both a minimum number of tracks and a
  minimum wall-clock gap since the last one. ``narration_frequency`` scales the
  track gap; at ``0.0`` the DJ is mute.
* **Never repeats itself.** Anything close to one of the last few lines is
  suppressed rather than reworded.
* **Never interrupts.** Output is text for the client to surface between
  tracks; nothing here touches playback.

Template selection is rotational rather than random — same session state gives
the same line, which keeps behaviour reproducible.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Literal

from app.services.dj.context import DJContext
from app.services.dj.strategy import DJDecision

NarrationKind = Literal[
    "welcome", "artist_intro", "vibe_shift", "energy", "trend", "milestone"
]

#: Hard floor between two spoken lines, regardless of configuration.
MIN_SECONDS_BETWEEN = 90.0
#: Frequency ``1.0`` still leaves this many tracks between lines.
MIN_TRACKS_BETWEEN = 3
#: Additional track gap applied as frequency falls toward zero.
MAX_EXTRA_TRACK_GAP = 9
#: Below this frequency the DJ never speaks.
MUTE_THRESHOLD = 0.05


@dataclass(frozen=True)
class Narration:
    """One short line from the DJ."""

    kind: NarrationKind
    text: str
    source: Literal["template", "ai"] = "template"

    def to_document(self) -> dict[str, Any]:
        return {"kind": self.kind, "text": self.text, "source": self.source}


#: Templates per narration kind. ``{artist}`` / ``{count}`` are filled in when
#: available; a template whose placeholder cannot be resolved is skipped.
_TEMPLATES: dict[NarrationKind, tuple[str, ...]] = {
    "welcome": (
        "Welcome back. Picking up where your ear left off.",
        "Good to have you back — easing into something familiar.",
        "Back at it. Starting close to home.",
    ),
    "artist_intro": (
        "Bringing in {artist} — think you'll like this one.",
        "Something new next: {artist}.",
        "{artist} is up. First time on your radio.",
    ),
    "vibe_shift": (
        "Reading the room — changing direction.",
        "That wasn't landing. Taking this somewhere else.",
        "Switching lanes for a bit.",
    ),
    "energy": (
        "Bringing the energy up from here.",
        "Winding this down a little.",
        "Easing off the pace.",
    ),
    "trend": (
        "You've been deep in {artist} tonight.",
        "Heavy rotation on {artist} lately.",
        "{artist} keeps coming back around — spreading things out.",
    ),
    "milestone": (
        "{count} tracks in. Still with you.",
        "Nice long run — {count} tracks so far.",
    ),
}


class NarrationService:
    """Decides whether the DJ speaks, and picks the line."""

    def narrate(self, ctx: DJContext, decision: DJDecision) -> Narration | None:
        """Return a line, or ``None`` when the DJ should stay quiet."""
        config = ctx.config
        if config.narration_frequency <= MUTE_THRESHOLD:
            return None
        if not decision.narration_worthy:
            return None
        if not self._cooldown_elapsed(ctx):
            return None

        kind = self._kind_for(ctx, decision)
        if kind is None:
            return None

        text = self._render(kind, ctx, decision)
        if text is None or self._is_repeat(text, ctx):
            return None
        return Narration(kind=kind, text=text)

    # --- gating ---
    def _cooldown_elapsed(self, ctx: DJContext) -> bool:
        """Both the track gap and the wall-clock gap must have passed."""
        strategy = ctx.session.strategy or {}
        last_track = int(strategy.get("narrated_at_track") or 0)
        gap = MIN_TRACKS_BETWEEN + round(
            (1.0 - ctx.config.narration_frequency) * MAX_EXTRA_TRACK_GAP
        )
        # The opening line of a session has no predecessor to wait behind.
        if ctx.session.narration_count == 0:
            return True
        if (ctx.tracks_played - last_track) < gap:
            return False

        last_at = _parse_iso(ctx.session.narration_last_at)
        if last_at is None:
            return True
        elapsed = (datetime.now(timezone.utc) - last_at).total_seconds()
        return elapsed >= MIN_SECONDS_BETWEEN

    def _is_repeat(self, text: str, ctx: DJContext) -> bool:
        """Suppress anything the DJ has said recently."""
        return text in ctx.session.narration_recent

    # --- selection ---
    @staticmethod
    def _kind_for(ctx: DJContext, decision: DJDecision) -> NarrationKind | None:
        if ctx.returning_after_break or decision.intent == "warm_up":
            return "welcome"
        if decision.intent == "pivot":
            return "vibe_shift"
        if decision.intent == "refresh":
            return "trend" if ctx.dominant_artist else "artist_intro"
        if decision.intent in ("lift_energy", "cool_down"):
            return "energy"
        if decision.intent == "rediscover":
            return "artist_intro"
        if ctx.tracks_played and ctx.tracks_played % 25 == 0:
            return "milestone"
        return None

    def _render(
        self, kind: NarrationKind, ctx: DJContext, decision: DJDecision
    ) -> str | None:
        options = _TEMPLATES[kind]
        if not options:
            return None
        # Rotate deterministically so consecutive lines of the same kind differ.
        index = ctx.session.narration_count % len(options)
        for offset in range(len(options)):
            template = options[(index + offset) % len(options)]
            rendered = self._fill(template, kind, ctx, decision)
            if rendered is not None and rendered not in ctx.session.narration_recent:
                return rendered
        return None

    @staticmethod
    def _fill(
        template: str, kind: NarrationKind, ctx: DJContext, decision: DJDecision
    ) -> str | None:
        """Fill placeholders, or return ``None`` if the data isn't available."""
        if "{artist}" in template:
            artist = _display_artist(ctx)
            if not artist:
                return None
            template = template.replace("{artist}", artist)
        if "{count}" in template:
            template = template.replace("{count}", str(ctx.tracks_played))
        # The energy templates are directional; pick the matching half.
        if kind == "energy":
            wants_lift = decision.energy_bias > 0
            is_lift_line = "up" in template
            if wants_lift != is_lift_line:
                return None
        return template


def _display_artist(ctx: DJContext) -> str | None:
    """The best human-readable artist name available for narration."""
    if ctx.dominant_artist:
        for observation in reversed(ctx.session.observations):
            if observation.artist_norm == ctx.dominant_artist and observation.artist:
                return observation.artist
    last = ctx.session.observations[-1] if ctx.session.observations else None
    return last.artist if last and last.artist else None


def _parse_iso(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
