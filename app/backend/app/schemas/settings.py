"""Request bodies for the settings endpoints."""
from __future__ import annotations

from pydantic import BaseModel, Field


class AISettingsIn(BaseModel):
    """Save/replace the Gemini API key."""

    gemini_api_key: str = Field(min_length=1)
