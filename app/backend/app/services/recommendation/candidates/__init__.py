"""Candidate sources for the radio engine.

Each source is independent and blind to the others; the engine merges their
output. To add a new signal source, implement :class:`CandidateSource` and
register it in :data:`DEFAULT_SOURCES`.
"""

from app.services.recommendation.candidates.base import Candidate, CandidateSource
from app.services.recommendation.candidates.co_occurrence import CoOccurrenceSource
from app.services.recommendation.candidates.local import (
    SameAlbumSource,
    SameArtistSource,
    SimilarArtistSource,
)
from app.services.recommendation.candidates.youtube import YouTubeRadioSource

# Order is cosmetic; scoring (not source order) determines ranking.
DEFAULT_SOURCES: list[CandidateSource] = [
    SameArtistSource(),
    SameAlbumSource(),
    SimilarArtistSource(),
    CoOccurrenceSource(),
    YouTubeRadioSource(),
]

__all__ = [
    "Candidate",
    "CandidateSource",
    "SameArtistSource",
    "SameAlbumSource",
    "SimilarArtistSource",
    "CoOccurrenceSource",
    "YouTubeRadioSource",
    "DEFAULT_SOURCES",
]
