"""External integrations (YouTube / YouTube Music, MusicBrainz)."""

from app.providers.youtube import YouTubeClient, get_youtube_client

__all__ = ["YouTubeClient", "get_youtube_client"]
