from __future__ import annotations

from fastapi import APIRouter, Depends

from app.api.deps import get_analytics_service, get_current_user
from app.schemas.analytics import ListenIn
from app.services.analytics_service import AnalyticsService

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.post("/listen")
def listen(
    body: ListenIn,
    user=Depends(get_current_user),
    analytics: AnalyticsService = Depends(get_analytics_service),
):
    return analytics.record_listen(user["id"], body)
