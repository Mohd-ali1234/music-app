"""Aggregate API router: mounts every route module under ``/api``."""
from __future__ import annotations

from fastapi import APIRouter

from app.api.routes import (
    analytics,
    auth,
    dj,
    health,
    home,
    library,
    playlists,
    profile,
    queue,
    search,
    settings,
    songs,
)

api_router = APIRouter(prefix="/api")

for module in (
    health,
    auth,
    search,
    songs,
    queue,
    home,
    library,
    playlists,
    profile,
    analytics,
    dj,
    settings,
):
    api_router.include_router(module.router)
