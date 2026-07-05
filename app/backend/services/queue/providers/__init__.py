from .discovery_provider import DiscoveryProvider
from .favorites_provider import FavoritesProvider
from .recent_provider import RecentProvider
from .same_album_provider import SameAlbumProvider
from .same_artist_provider import SameArtistProvider
from .search_history_provider import SearchHistoryProvider
from .time_provider import TimeProvider

__all__ = ["SameArtistProvider", "SameAlbumProvider", "FavoritesProvider",
           "RecentProvider", "SearchHistoryProvider", "TimeProvider", "DiscoveryProvider"]
