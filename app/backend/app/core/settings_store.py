"""Runtime-mutable settings that must survive process restarts without living
in Mongo — currently just the Gemini API key.

Unlike ``core.config.Settings`` (frozen at process start from the environment),
values here can change while the process is running: the desktop Settings
screen calls ``set_gemini_api_key`` and the very next AI call picks it up.
Persistence is via the OS credential store (``keyring``: Windows Credential
Manager / macOS Keychain / Linux Secret Service) so the key survives app
restarts without ever touching a config file or the database.
"""
from __future__ import annotations

import keyring

from app.core.config import get_settings

_SERVICE_NAME = "music-player-desktop"
_GEMINI_KEY_NAME = "gemini_api_key"

_gemini_key_cache: str | None = None


def get_gemini_api_key() -> str:
    """Current Gemini API key: keyring first, falling back to the
    ``GEMINI_API_KEY`` env var so non-desktop deployments (dev, Render, ...)
    keep working exactly as before."""
    global _gemini_key_cache
    if _gemini_key_cache is None:
        try:
            _gemini_key_cache = keyring.get_password(_SERVICE_NAME, _GEMINI_KEY_NAME) or ""
        except Exception:  # noqa: BLE001 - no OS keyring backend available
            _gemini_key_cache = ""
    return _gemini_key_cache or get_settings().gemini_api_key


def set_gemini_api_key(api_key: str) -> None:
    """Persist a new Gemini API key and make it take effect immediately."""
    global _gemini_key_cache
    keyring.set_password(_SERVICE_NAME, _GEMINI_KEY_NAME, api_key)
    _gemini_key_cache = api_key


def gemini_key_configured() -> bool:
    return bool(get_gemini_api_key())


def gemini_key_suffix() -> str | None:
    key = get_gemini_api_key()
    if not key:
        return None
    return key[-4:]
