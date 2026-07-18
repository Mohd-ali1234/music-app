from __future__ import annotations

from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/")
def root():
    return {"status": "ok", "service": "music-api"}
