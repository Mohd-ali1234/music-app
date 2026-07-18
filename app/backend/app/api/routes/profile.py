from __future__ import annotations

from fastapi import APIRouter, Depends
from pymongo.database import Database

from app.api.deps import get_current_user, get_database
from app.repositories import (
    AnalyticsRepository,
    LibraryRepository,
    PlaylistRepository,
    PlaysRepository,
    UserStatsRepository,
)

router = APIRouter(tags=["profile"])


@router.get("/profile/stats")
def profile_stats(
    user=Depends(get_current_user),
    database: Database = Depends(get_database),
):
    user_id = user["id"]
    plays = PlaysRepository(database)
    analytics = AnalyticsRepository(database)
    stats = UserStatsRepository(database)
    library = LibraryRepository(database)
    playlists = PlaylistRepository(database)

    total_plays = plays.count_for_user(user_id) + analytics.count_play_events(user_id)
    return {
        "total_plays": total_plays,
        "likes": library.count_likes(user_id),
        "playlists": playlists.count_for_owner(user_id),
        "top_artists": stats.top_artists(user_id, limit=10),
        "top_songs": stats.top_songs(user_id, limit=10),
    }
