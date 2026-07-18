"""Centralized application configuration.

Every environment variable the backend reads is declared here, in one place,
instead of being scattered across modules with ``os.environ[...]`` lookups.
This makes the configuration surface auditable and gives us a single spot to
validate/fail-fast.

Backwards compatibility: historically ``db.py`` read ``MONGODB_URL`` /
``MONGODB_DB`` while ``.env.example`` documented ``MONGO_URL`` / ``DB_NAME``.
We accept both spellings (canonical name first) so existing deployments keep
working regardless of which pair their ``.env`` uses.
"""
from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

# .../app/backend/app/core/config.py -> parents[2] == .../app/backend
BACKEND_ROOT = Path(__file__).resolve().parents[2]

# Load the backend .env exactly once, as early as possible.
load_dotenv(BACKEND_ROOT / ".env")


def _first_env(*names: str, default: str = "") -> str:
    """Return the first non-empty environment variable among ``names``."""
    for name in names:
        value = os.environ.get(name)
        if value:
            return value
    return default


class Settings:
    """Immutable, process-wide settings resolved from the environment."""

    def __init__(self) -> None:
        self.app_env: str = os.environ.get("APP_ENV", "development").strip().lower()
        self.is_production: bool = self.app_env == "production"

        # --- Database ---
        self.mongodb_url: str = _first_env("MONGODB_URL", "MONGO_URL")
        self.mongodb_db: str = _first_env("MONGODB_DB", "DB_NAME", default="music_player")

        # --- Auth ---
        self.jwt_secret: str = os.environ.get("JWT_SECRET", "").strip()
        self.jwt_algorithm: str = "HS256"
        self.jwt_token_days: int = 30

        # --- CORS ---
        self.cors_origins: list[str] = os.environ.get("CORS_ORIGINS", "*").split(",")

        # --- External providers ---
        self.musicbrainz_user_agent: str = os.environ.get(
            "MUSICBRAINZ_USER_AGENT",
            "SemanticMusicPlayer/1.0 (contact: example@example.com)",
        )

        self._validate()

    def _validate(self) -> None:
        """Fail fast on misconfiguration that would be unsafe in production."""
        if self.is_production and not self.jwt_secret:
            raise RuntimeError("JWT_SECRET must be set in production")

    @property
    def effective_jwt_secret(self) -> str:
        """The signing secret, with a dev-only fallback outside production."""
        if self.jwt_secret:
            return self.jwt_secret
        if self.is_production:  # pragma: no cover - guarded by _validate()
            raise RuntimeError("JWT_SECRET must be set in production")
        return "dev-insecure-secret-do-not-use-in-prod"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return the process-wide :class:`Settings` singleton."""
    return Settings()
