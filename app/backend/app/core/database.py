"""MongoDB (synchronous PyMongo) connection and index management.

The client and database handles are created lazily and memoized, so importing
this module never opens a socket. Route handlers are plain ``def`` functions,
so FastAPI runs the blocking PyMongo calls in its threadpool.
"""
from __future__ import annotations

from pymongo import ASCENDING, DESCENDING, MongoClient
from pymongo.database import Database

from app.core.config import get_settings

_client: MongoClient | None = None
_db: Database | None = None


def get_client() -> MongoClient:
    global _client
    if _client is None:
        _client = MongoClient(get_settings().mongodb_url)
    return _client


def get_db() -> Database:
    global _db
    if _db is None:
        _db = get_client()[get_settings().mongodb_db]
    return _db


def ensure_indexes() -> None:
    """Create all indexes the application relies on (idempotent)."""
    db = get_db()
    db.users.create_index([("email", ASCENDING)], unique=True)
    db.songs.create_index([("id", ASCENDING)], unique=True)
    db.songs.create_index([("yt_video_id", ASCENDING)], unique=True, sparse=True)
    db.songs.create_index([("artist_norm", ASCENDING)])
    db.songs.create_index([("album_norm", ASCENDING)])
    db.likes.create_index([("user_id", ASCENDING), ("song_id", ASCENDING)], unique=True)
    db.plays.create_index([("user_id", ASCENDING), ("played_at", DESCENDING)])
    db.plays.create_index([("song_id", ASCENDING)])
    db.recently_played.create_index([("user_id", ASCENDING), ("played_at", DESCENDING)])
    db.search_history.create_index([("user_id", ASCENDING), ("created_at", DESCENDING)])
    db.listening_sessions.create_index([("user_id", ASCENDING), ("started_at", DESCENDING)])
    db.listening_sessions.create_index([("song_ids", ASCENDING)])
    db.listening_sessions.create_index([("song_yt_ids", ASCENDING)])
    db.interaction_events.create_index([("user_id", ASCENDING), ("created_at", DESCENDING)])
    db.user_song_stats.create_index(
        [("user_id", ASCENDING), ("song_id", ASCENDING)], unique=True
    )
    db.user_artist_stats.create_index(
        [("user_id", ASCENDING), ("artist_norm", ASCENDING)], unique=True
    )
    db.user_album_stats.create_index(
        [("user_id", ASCENDING), ("album_norm", ASCENDING)], unique=True
    )
    db.playlists.create_index([("owner_id", ASCENDING), ("updated_at", DESCENDING)])
    db.playlist_analytics.create_index([("playlist_id", ASCENDING)], unique=True)
