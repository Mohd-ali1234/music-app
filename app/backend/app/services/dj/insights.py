"""The DJ's only language-model surface.

Everything that decides *what plays next* is deterministic (see
:mod:`~app.services.dj.strategy`). The model is used strictly for the things
deterministic code is bad at — reading a session back to the listener in
natural language, and phrasing a one-off line with some personality.

Three properties make this safe to ship:

* **Off the hot path.** Nothing here is called during queue generation. The
  client requests insights separately, when it is idle.
* **Always optional.** Any failure — unconfigured provider, timeout, malformed
  JSON — falls back to a deterministic summary. The DJ never breaks because a
  model was unavailable.
* **Cheap input.** The prompt carries a compact, pre-aggregated digest (counts
  and artist names), never raw event logs.
"""
from __future__ import annotations

import asyncio
import json
import logging
from dataclasses import dataclass
from typing import Any

from app.ai import AIMessage
from app.ai.factory import get_ai_client
from app.ai.types import AIProviderError
from app.services.dj.context import DJContext

log = logging.getLogger(__name__)

_SYSTEM_PROMPT = (
    "You are a radio DJ reviewing a listener's current session. "
    "You are warm, concise and never sycophantic. You return valid JSON only."
)

_MAX_SUMMARY_CHARS = 240
_MAX_LINE_CHARS = 120


@dataclass(frozen=True)
class SessionInsight:
    """A natural-language read on the session."""

    summary: str
    line: str | None
    tags: tuple[str, ...]
    source: str

    def to_document(self) -> dict[str, Any]:
        return {
            "summary": self.summary,
            "line": self.line,
            "tags": list(self.tags),
            "source": self.source,
        }


class InsightService:
    """Produces session summaries, with a deterministic fallback."""

    def generate(self, ctx: DJContext) -> SessionInsight:
        """Return an insight for ``ctx``, never raising."""
        digest = self._digest(ctx)
        fallback = self._deterministic(ctx, digest)
        if ctx.tracks_played < 3:
            # Too little has happened to be worth a model call.
            return fallback

        try:
            client = get_ai_client()
        except Exception as exc:  # noqa: BLE001 - provider may be unconfigured
            log.debug("DJ insights: no AI provider available (%s)", exc)
            return fallback

        instruction = (
            "Summarize this listening session for the listener.\n"
            f"Session data: {json.dumps(digest)}\n\n"
            'Return ONLY JSON: {"summary":"two short sentences, second person",'
            '"line":"one optional short DJ aside, or null",'
            '"tags":["3-5 lowercase mood or genre words"]}\n'
            "Be specific to the data. Never invent artists or songs that are "
            "not listed. Never mention that you are an AI."
        )
        try:
            response = asyncio.run(
                client.complete([
                    AIMessage("system", _SYSTEM_PROMPT),
                    AIMessage("user", instruction),
                ])
            )
            payload = _parse_json(response.text)
            summary = str(payload.get("summary") or "").strip()
            if not summary:
                raise ValueError("empty summary")
            line = payload.get("line")
            tags = [
                str(tag).strip().lower()
                for tag in (payload.get("tags") or [])
                if str(tag).strip()
            ]
            return SessionInsight(
                summary=summary[:_MAX_SUMMARY_CHARS],
                line=str(line)[:_MAX_LINE_CHARS] if line else None,
                tags=tuple(tags[:5]),
                source=response.provider,
            )
        except (AIProviderError, ValueError, TypeError, json.JSONDecodeError) as exc:
            log.info("DJ insights fell back to deterministic summary: %s", exc)
            return fallback
        except Exception as exc:  # noqa: BLE001 - insights are never critical
            log.warning("DJ insights failed unexpectedly: %s", exc, exc_info=True)
            return fallback

    # --- prompt input ---
    @staticmethod
    def _digest(ctx: DJContext) -> dict[str, Any]:
        """A compact, privacy-light description of the session."""
        top_session_artists = sorted(
            ctx.session.artist_counts.items(), key=lambda kv: kv[1], reverse=True
        )[:5]
        return {
            "tracks_played": ctx.tracks_played,
            "minutes": round(ctx.elapsed_minutes),
            "skip_rate": ctx.skip_rate,
            "completion_rate": ctx.completion_rate,
            "replay_rate": ctx.replay_rate,
            "time_of_day": ctx.time_of_day,
            "energy": ctx.current_energy,
            "energy_trend": ctx.energy_trend,
            "session_artists": [name for name, _ in top_session_artists],
            "all_time_artists": list(ctx.top_artist_norms[:5]),
        }

    # --- fallback ---
    @staticmethod
    def _deterministic(ctx: DJContext, digest: dict[str, Any]) -> SessionInsight:
        """A useful summary built without any model call."""
        if ctx.tracks_played == 0:
            return SessionInsight(
                summary="Session just started. Play something and the DJ will take it from there.",
                line=None,
                tags=(),
                source="deterministic",
            )

        parts = [
            f"{ctx.tracks_played} track{'s' if ctx.tracks_played != 1 else ''} "
            f"over {round(ctx.elapsed_minutes)} minutes."
        ]
        if ctx.completion_rate >= 0.7:
            parts.append("You're staying with almost everything.")
        elif ctx.skip_rate >= 0.4:
            parts.append("Plenty of skips — still hunting for the right vibe.")
        elif ctx.dominant_artist:
            parts.append(f"Leaning heavily on {ctx.dominant_artist}.")

        tags: list[str] = [ctx.time_of_day]
        tags.append("high energy" if ctx.current_energy >= 0.6 else "low key")
        if ctx.replay_rate >= 0.2:
            tags.append("on repeat")

        return SessionInsight(
            summary=" ".join(parts),
            line=None,
            tags=tuple(tags),
            source="deterministic",
        )


def _parse_json(text: str) -> dict[str, Any]:
    """Parse model output, tolerating markdown code fences."""
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.removeprefix("```json").removeprefix("```").removesuffix("```")
    parsed = json.loads(cleaned.strip())
    if not isinstance(parsed, dict):
        raise ValueError("expected a JSON object")
    return parsed
