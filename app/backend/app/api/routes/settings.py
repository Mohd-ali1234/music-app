"""App settings endpoints.

Currently just the Gemini API key, entered from the desktop Settings screen
and persisted through the OS credential store (``core.settings_store``) —
never through Mongo or a config file. Purely additive: no existing route,
request shape, or response envelope changes.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.core.settings_store import (
    gemini_key_configured,
    gemini_key_suffix,
    set_gemini_api_key,
)
from app.schemas.settings import AISettingsIn

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("/ai")
def get_ai_settings(user=Depends(get_current_user)):
    return {
        "provider": get_settings().ai_provider,
        "gemini_key_configured": gemini_key_configured(),
        "gemini_key_suffix": gemini_key_suffix(),
    }


@router.put("/ai")
def update_ai_settings(body: AISettingsIn, user=Depends(get_current_user)):
    set_gemini_api_key(body.gemini_api_key.strip())
    return {
        "gemini_key_configured": gemini_key_configured(),
        "gemini_key_suffix": gemini_key_suffix(),
    }
