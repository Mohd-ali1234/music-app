from db import get_db as _get_db
from .providers import (DiscoveryProvider, FavoritesProvider, RecentProvider, SameAlbumProvider,
                        SameArtistProvider, SearchHistoryProvider, TimeProvider)
from .queue_manager import QueueManager
from .ranking_engine import RankingEngine


def build_queue_manager(db=None):
    db = db or _get_db()
    providers = [SameArtistProvider(db), SameAlbumProvider(db), FavoritesProvider(db),
                 RecentProvider(db), SearchHistoryProvider(db), TimeProvider(db), DiscoveryProvider(db)]
    return QueueManager(db.songs, RankingEngine(providers))
