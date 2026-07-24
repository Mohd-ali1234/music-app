"""Converts a creative playlist brief into safe, searchable music queries."""
from __future__ import annotations
import asyncio
import json
import logging
from fastapi import HTTPException
from app.ai import AIMessage
from app.ai.providers import GeminiProvider
from app.ai.types import AIProviderError
from app.core.config import get_settings
from app.services.playlist_creation_service import PlaylistCreationService

class AIPlaylistService:
    def __init__(self, creator: PlaylistCreationService) -> None: self._creator = creator
    def create(self, user_id: str, prompt: str, track_count: int) -> dict:
        instruction = f'''You are a precise music curator. Build a playlist from this user brief: {prompt!r}.
Return ONLY JSON: {{"name":"short playlist title","description":"one vivid sentence","songs":["Song Title - Artist"]}}.
Choose exactly {track_count} real, distinct, widely searchable recordings. Match the mood, pacing, era and genre. Never invent songs or artists.'''
        try:
            settings = get_settings()
            # Playlist creation deliberately uses Gemini: it is a curated,
            # structured-output workflow, independent from the app's future
            # conversational provider selection.
            client = GeminiProvider(
                settings.gemini_model,
                settings.ai_timeout_seconds, settings.ai_max_retries,
            )
            result = asyncio.run(client.complete([AIMessage("system", "You return valid JSON only."), AIMessage("user", instruction)]))
            payload = json.loads(result.text.removeprefix("```json").removesuffix("```").strip())
            songs = [str(song).strip() for song in payload.get("songs", []) if str(song).strip()]
            if len(songs) < 3: raise ValueError("too few songs")
        except (AIProviderError, ValueError, TypeError, json.JSONDecodeError) as exc:
            logging.getLogger(__name__).warning("AI playlist generation failed: %s", exc)
            raise HTTPException(status_code=502, detail="Playlist AI could not produce a usable track list. Please try again.") from exc
        created = self._creator.create_from_searches(user_id=user_id, name=str(payload.get("name") or "Made for you")[:120], description=str(payload.get("description") or prompt)[:300], song_queries=songs[:track_count])
        created["ai_provider"] = result.provider
        return created
