from __future__ import annotations

from fastapi import APIRouter, Depends

from app.api.deps import get_analytics_service, get_current_user
from app.schemas.analytics import (
    InteractionEvent,
    SessionEnd,
    SessionHeartbeat,
    SessionStart,
)
from app.services.analytics_service import AnalyticsService

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.post("/session/start")
def session_start(
    body: SessionStart,
    user=Depends(get_current_user),
    analytics: AnalyticsService = Depends(get_analytics_service),
):
    return analytics.start_session(user["id"], body)


@router.post("/session/heartbeat")
def session_heartbeat(
    body: SessionHeartbeat,
    user=Depends(get_current_user),
    analytics: AnalyticsService = Depends(get_analytics_service),
):
    return analytics.record_progress(user["id"], body)


@router.post("/session/end")
def session_end(
    body: SessionEnd,
    user=Depends(get_current_user),
    analytics: AnalyticsService = Depends(get_analytics_service),
):
    return analytics.end_session(user["id"], body)


@router.post("/event")
def event(
    body: InteractionEvent,
    user=Depends(get_current_user),
    analytics: AnalyticsService = Depends(get_analytics_service),
):
    return analytics.record_event(user["id"], body)
