"""Data-access layer.

Each repository wraps a small set of related MongoDB collections and exposes
intent-revealing methods, so query construction lives in exactly one place and
services never touch PyMongo directly. Repositories are cheap to construct
(the underlying client/database handles are memoized singletons).
"""

from app.repositories.analytics import AnalyticsRepository
from app.repositories.library import LibraryRepository
from app.repositories.playlists import PlaylistRepository
from app.repositories.plays import PlaysRepository
from app.repositories.search_history import SearchHistoryRepository
from app.repositories.songs import SongRepository
from app.repositories.stats import UserStatsRepository
from app.repositories.users import UserRepository

__all__ = [
    "AnalyticsRepository",
    "LibraryRepository",
    "PlaylistRepository",
    "PlaysRepository",
    "SearchHistoryRepository",
    "SongRepository",
    "UserStatsRepository",
    "UserRepository",
]
