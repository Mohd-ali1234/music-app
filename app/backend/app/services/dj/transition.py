"""Track-to-track flow: how a queue is *ordered* once its members are chosen.

Selection decides *which* songs belong in the queue; this module decides the
sequence they play in. It is the difference between a correct playlist and one
that feels mixed.

Four forces are balanced, each expressed as a cost:

* **Energy adjacency** — consecutive tracks should sit near each other on the
  (heuristic) energy scale, while the queue as a whole traces the arc the
  strategy asked for.
* **Artist spacing** — the same artist should not resurface too soon.
* **Scarcity pressure** — an artist holding several of the remaining slots has
  to start appearing *now*. Without this term a purely spacing-driven walk
  spends its diverse artists early and clumps the over-represented one at the
  tail, which is precisely the artifact spacing was meant to prevent.
* **Relevance** — the recommendation engine already ranked these candidates;
  ordering should bend that ranking, not discard it.

The result is a greedy nearest-neighbour walk. Greedy is deliberate: it is
O(n²) on a ≤30-track queue (trivial) and, unlike a global optimum, it degrades
gracefully — a single awkward track never reshuffles the whole queue.
"""
from __future__ import annotations

from collections import Counter
from typing import Any

from app.services.dj.config import DJConfig
from app.services.dj.energy import estimate_energy

#: Relative influence of each cost term. Energy and artist spacing are the
#: DJ's job; the relevance term keeps the engine's ranking meaningfully intact.
_W_ENERGY = 1.0
_W_ARTIST = 1.4
_W_RANK = 0.55
_W_PRESSURE = 0.9


class TransitionManager:
    """Orders a set of tracks into a smooth, artist-spaced, arced sequence."""

    def arrange(
        self,
        *,
        seed: dict[str, Any],
        tracks: list[dict[str, Any]],
        config: DJConfig,
        energy_bias: float,
    ) -> list[dict[str, Any]]:
        """Return ``tracks`` reordered to follow smoothly from ``seed``.

        ``energy_bias`` is the strategy's requested drift over the whole queue,
        ``-1.0`` (wind right down) to ``1.0`` (build right up). When
        ``config.energy_control`` is off the arc is ignored and only artist
        spacing and relevance shape the order.
        """
        if len(tracks) < 2:
            return list(tracks)

        start_energy = estimate_energy(seed)
        remaining = list(enumerate(tracks))  # (original_rank, song)
        counts: Counter[str] = Counter(_artist_key(song) for _, song in remaining)
        ordered: list[dict[str, Any]] = []
        recent_artists: list[str] = [_artist_key(seed)]
        gap = config.min_gap_between_same_artist
        total = len(tracks)

        for step in range(total):
            target = self._target_energy(
                start_energy, energy_bias, step, total, config.energy_control
            )
            best_position = min(
                range(len(remaining)),
                key=lambda i: self._cost(
                    remaining[i],
                    target,
                    recent_artists,
                    gap,
                    total,
                    config,
                    counts,
                    len(remaining),
                ),
            )
            rank, song = remaining.pop(best_position)
            counts[_artist_key(song)] -= 1
            ordered.append(song)
            recent_artists.append(_artist_key(song))

        return ordered

    # --- cost model ---
    def _cost(
        self,
        entry: tuple[int, dict[str, Any]],
        target_energy: float,
        recent_artists: list[str],
        configured_gap: int,
        total: int,
        config: DJConfig,
        counts: Counter[str],
        remaining_total: int,
    ) -> float:
        rank, song = entry
        cost = _W_RANK * (rank / max(1, total))

        if config.energy_control:
            cost += _W_ENERGY * abs(estimate_energy(song) - target_energy)

        artist = _artist_key(song)
        if not artist:
            return cost

        outstanding = max(1, counts.get(artist, 1))
        # The widest spacing still achievable given how many of this artist are
        # left. Demanding more than this cannot be satisfied and only defers
        # the repeats into a clump at the end of the queue.
        feasible_gap = (remaining_total - 1) // outstanding
        gap = max(1, min(configured_gap, feasible_gap))

        if artist in recent_artists[-gap:]:
            # Distance-weighted: an immediate repeat hurts more than a near one.
            position = _last_index(recent_artists, artist)
            closeness = 1.0 - ((len(recent_artists) - 1 - position) / max(1, gap))
            cost += _W_ARTIST * max(0.15, closeness)

        # Over-represented artists get a discount so they are spread across the
        # whole queue instead of surviving to the tail.
        cost -= _W_PRESSURE * (outstanding - 1) / max(1, remaining_total)

        return cost

    @staticmethod
    def _target_energy(
        start: float, bias: float, step: int, total: int, energy_control: bool
    ) -> float:
        """The energy the queue should be sitting at by ``step``.

        A linear ramp from the seed's energy toward ``start + bias``, capped so
        the arc never demands an impossible value. Deliberately gentle: real
        DJ sets move in nudges, not jumps.
        """
        if not energy_control or total <= 1:
            return start
        progress = step / (total - 1)
        # Halve the requested bias — a full swing across one queue is jarring.
        return max(0.0, min(1.0, start + bias * 0.5 * progress))


def _artist_key(song: dict[str, Any]) -> str:
    return (song.get("artist_norm") or song.get("artist") or "").casefold().strip()


def _last_index(values: list[str], target: str) -> int:
    for index in range(len(values) - 1, -1, -1):
        if values[index] == target:
            return index
    return -1
