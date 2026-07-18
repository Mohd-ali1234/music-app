from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from app.api.deps import get_current_user, get_search_service
from app.services.search import SearchService

router = APIRouter(tags=["search"])


@router.get("/songs/search")
def songs_search(
    q: str = Query(..., min_length=1, max_length=120),
    user=Depends(get_current_user),
    search: SearchService = Depends(get_search_service),
):
    return search.search(query=q, user_id=user["id"])
