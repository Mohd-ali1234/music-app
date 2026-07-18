from __future__ import annotations

from fastapi import APIRouter, Depends

from app.api.deps import get_current_user, get_home_service
from app.services.home_service import HomeService

router = APIRouter(tags=["home"])


@router.get("/home/feed")
def home_feed(
    user=Depends(get_current_user),
    home: HomeService = Depends(get_home_service),
):
    return home.feed(user["id"])
