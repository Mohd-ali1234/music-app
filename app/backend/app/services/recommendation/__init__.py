"""Radio / queue recommendation engine.

A seed track fans out to several *candidate sources* (same artist, same album,
similar artists, real listening co-occurrence, YouTube "radio mix"). Each source
emits :class:`~app.services.recommendation.candidates.base.Candidate` objects
carrying named *signals*. A :class:`~app.services.recommendation.scoring.ScoringPolicy`
turns signals into a score, and the :class:`~app.services.recommendation.engine.RadioEngine`
merges, personalizes, scores, and lays out a curated, diversified queue.

Adding a new signal is a two-line change: emit it from a source (or enrich it),
and give it a weight in :class:`ScoringPolicy`.
"""

from app.services.recommendation.queue_service import QueueService

__all__ = ["QueueService"]
