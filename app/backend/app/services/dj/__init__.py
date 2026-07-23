"""The AI DJ: a continuous, session-aware conductor for the radio engine.

The DJ is **not** a second recommender. Everything about *which* tracks are
related to a seed stays in :mod:`app.services.recommendation`. What the DJ adds
is the thing a stateless recommender structurally cannot have — memory of the
session in progress, and a point of view about what should happen next.

Module map (each has a single responsibility):

``config``           tunable dials, clamped and serializable
``energy``           metadata-only energy proxy (documented heuristic)
``session``          session lifecycle + the observation log
``context``          raw observations -> behaviour signals
``strategy``         deterministic, ordered decision rules
``tuning``           DJ intent -> the engine's own ScoringPolicy/discovery knobs
``queue_optimizer``  session-aware filtering of a generated queue
``transition``       track-to-track ordering and the energy arc
``feedback``         fast, session-scoped learning from skips and replays
``narration``        short spoken lines, rate limited, no I/O
``insights``         the only LLM surface: summaries, off the hot path
``controller``       sequences all of the above

Only ``controller`` and the dataclasses it returns are intended for use outside
this package.
"""

from app.services.dj.config import DEFAULT_CONFIG, DJConfig
from app.services.dj.context import DJContext, DJContextBuilder
from app.services.dj.controller import DJController, DJCycle
from app.services.dj.insights import InsightService, SessionInsight
from app.services.dj.session import DJSessionManager, SessionSnapshot

__all__ = [
    "DEFAULT_CONFIG",
    "DJConfig",
    "DJContext",
    "DJContextBuilder",
    "DJController",
    "DJCycle",
    "DJSessionManager",
    "InsightService",
    "SessionInsight",
    "SessionSnapshot",
]
