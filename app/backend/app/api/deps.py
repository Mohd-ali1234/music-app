"""FastAPI dependencies: authentication and service/repository wiring.

Repositories and services are constructed per-request. This is cheap because
the MongoDB client/database handles are memoized singletons, and it keeps the
object graph explicit and easy to override in tests.
"""
from __future__ import annotations

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pymongo.database import Database

from app.core.database import get_db
from app.core.security import decode_access_token
from app.providers import YouTubeClient, get_youtube_client
from app.repositories import (
    AnalyticsRepository,
    LibraryRepository,
    PlaylistRepository,
    PlaysRepository,
    SearchHistoryRepository,
    SongRepository,
    UserRepository,
    UserStatsRepository,
)
from app.services.analytics_service import AnalyticsService
from app.services.auth_service import AuthService
from app.services.home_service import HomeService
from app.services.recommendation import QueueService
from app.services.search import SearchService
from app.services.song_service import SongService

_bearer = HTTPBearer(auto_error=False)


# --- infrastructure ---
def get_database() -> Database:
    return get_db()


def get_youtube() -> YouTubeClient:
    return get_youtube_client()


# --- authentication ---
def get_current_user(
    cred: HTTPAuthorizationCredentials | None = Depends(_bearer),
    database: Database = Depends(get_database),
) -> dict:
    if cred is None or not cred.credentials:
        raise HTTPException(status_code=401, detail="Missing bearer token")
    try:
        payload = decode_access_token(cred.credentials)
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = UserRepository(database).get_by_id(payload["sub"])
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


# --- services ---
def get_auth_service(database: Database = Depends(get_database)) -> AuthService:
    return AuthService(UserRepository(database))


def get_search_service(
    database: Database = Depends(get_database),
    youtube: YouTubeClient = Depends(get_youtube),
) -> SearchService:
    return SearchService(
        songs=SongRepository(database),
        plays=PlaysRepository(database),
        history=SearchHistoryRepository(database),
        youtube=youtube,
    )


def get_song_service(
    database: Database = Depends(get_database),
    youtube: YouTubeClient = Depends(get_youtube),
) -> SongService:
    return SongService(songs=SongRepository(database), youtube=youtube)


def get_queue_service(
    database: Database = Depends(get_database),
    youtube: YouTubeClient = Depends(get_youtube),
) -> QueueService:
    return QueueService(
        songs=SongRepository(database),
        analytics=AnalyticsRepository(database),
        stats=UserStatsRepository(database),
        youtube=youtube,
    )


def get_home_service(
    database: Database = Depends(get_database),
    youtube: YouTubeClient = Depends(get_youtube),
) -> HomeService:
    return HomeService(
        library=LibraryRepository(database),
        stats=UserStatsRepository(database),
        songs=SongRepository(database),
        youtube=youtube,
    )


def get_analytics_service(
    database: Database = Depends(get_database),
) -> AnalyticsService:
    return AnalyticsService(
        analytics=AnalyticsRepository(database),
        stats=UserStatsRepository(database),
        songs=SongRepository(database),
    )


# --- repositories (for thin CRUD routes) ---
def get_song_repository(database: Database = Depends(get_database)) -> SongRepository:
    return SongRepository(database)


def get_library_repository(
    database: Database = Depends(get_database),
) -> LibraryRepository:
    return LibraryRepository(database)


def get_playlist_repository(
    database: Database = Depends(get_database),
) -> PlaylistRepository:
    return PlaylistRepository(database)
