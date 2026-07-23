"""A metadata-only energy proxy for DJ ordering.

The catalog stores no acoustic features (no tempo, key, loudness or valence),
so *real* energy analysis is not available. Rather than pretend otherwise, this
module derives a deliberately coarse ``0.0..1.0`` estimate from the metadata we
do have: title/album markers and track duration.

This is a **heuristic**, not a measurement. It is good enough for its only job —
deciding whether track B is a reasonable follow-on from track A, and giving a
queue a gentle arc instead of a random walk. Nothing else depends on it being
correct, and every consumer treats it as a soft preference.

If real audio features ever land on the song document (e.g. an ``energy`` or
``tempo`` field), :func:`estimate_energy` picks them up automatically and the
heuristic stops being used for those tracks.
"""
from __future__ import annotations

from typing import Any

#: Title/album markers that reliably signal a *calmer* rendition.
_LOW_ENERGY_MARKERS: tuple[tuple[str, float], ...] = (
    ("unplugged", 0.28),
    ("acoustic", 0.30),
    ("instrumental", 0.34),
    ("lofi", 0.24),
    ("lo-fi", 0.24),
    ("slowed", 0.20),
    ("reverb", 0.28),
    ("piano", 0.30),
    ("ballad", 0.30),
    ("lullaby", 0.16),
    ("sleep", 0.16),
    ("ambient", 0.20),
    ("chill", 0.30),
    ("sad", 0.30),
    ("stripped", 0.30),
)

#: Markers that reliably signal a *more intense* rendition.
_HIGH_ENERGY_MARKERS: tuple[tuple[str, float], ...] = (
    ("remix", 0.78),
    ("club", 0.86),
    ("dance", 0.80),
    ("edm", 0.88),
    ("techno", 0.88),
    ("house", 0.82),
    ("trap", 0.80),
    ("bass", 0.82),
    ("hard", 0.84),
    ("metal", 0.88),
    ("rock", 0.74),
    ("punk", 0.86),
    ("party", 0.82),
    ("banger", 0.84),
    ("sped up", 0.80),
    ("workout", 0.86),
    ("live", 0.70),
)

#: Neutral starting point when no marker matches.
_BASELINE = 0.50

# Duration shading: very short tracks skew punchy, very long ones skew ambient.
_SHORT_TRACK_SEC = 150
_LONG_TRACK_SEC = 420


def _marker_energy(haystack: str) -> float | None:
    """Strongest marker match in ``haystack``, or ``None`` when nothing matches.

    When a title carries both a calm and an intense marker (``"acoustic
    remix"``) the two are averaged rather than letting scan order decide.
    """
    low = [value for token, value in _LOW_ENERGY_MARKERS if token in haystack]
    high = [value for token, value in _HIGH_ENERGY_MARKERS if token in haystack]
    if low and high:
        return (min(low) + max(high)) / 2
    if low:
        return min(low)
    if high:
        return max(high)
    return None


def estimate_energy(song: dict[str, Any]) -> float:
    """Return a coarse ``0.0..1.0`` energy estimate for a wire-format song.

    Precedence:
    1. A real ``energy`` field on the document, if one ever exists.
    2. Title/album keyword markers.
    3. Duration-based shading around a neutral baseline.
    """
    provided = song.get("energy")
    if isinstance(provided, (int, float)) and 0.0 <= float(provided) <= 1.0:
        return float(provided)

    haystack = f"{song.get('title') or ''} {song.get('album') or ''}".casefold()
    energy = _marker_energy(haystack)
    if energy is None:
        energy = _BASELINE

    duration = song.get("duration") or song.get("duration_sec") or 0
    try:
        seconds = float(duration)
    except (TypeError, ValueError):
        seconds = 0.0
    if seconds > 0:
        if seconds <= _SHORT_TRACK_SEC:
            energy += 0.06
        elif seconds >= _LONG_TRACK_SEC:
            energy -= 0.08

    return round(max(0.0, min(1.0, energy)), 4)


def energy_distance(a: dict[str, Any], b: dict[str, Any]) -> float:
    """Absolute energy gap between two songs — ``0.0`` (identical) to ``1.0``."""
    return abs(estimate_energy(a) - estimate_energy(b))


def average_energy(songs: list[dict[str, Any]]) -> float:
    """Mean energy across ``songs``; ``_BASELINE`` for an empty list."""
    if not songs:
        return _BASELINE
    return round(sum(estimate_energy(s) for s in songs) / len(songs), 4)
