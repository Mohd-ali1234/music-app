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
import tempfile
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
        # Optional Netscape-format cookies.txt for yt-dlp. Needed on hosts
        # (Render, etc.) where YouTube blocks datacenter IPs with a "Sign in
        # to confirm you're not a bot" error. Either point YTDLP_COOKIES_FILE
        # at an uploaded Secret File, or paste the file's raw contents into
        # YTDLP_COOKIES_CONTENT (a plain env var works on any plan/tier) and
        # it's written to a temp file on startup.
        cookies_file = os.environ.get("YTDLP_COOKIES_FILE", "").strip()
        cookies_content = os.environ.get("YTDLP_COOKIES_CONTENT", "").strip()
        if not cookies_file and cookies_content:
            tmp_path = Path(tempfile.gettempdir()) / "ytdlp_cookies.txt"
            tmp_path.write_text(cookies_content, encoding="utf-8")
            cookies_file = str(tmp_path)
        self.ytdlp_cookies_file: str = cookies_file
        # Base URL of a bgutil-ytdlp-pot-provider HTTP server (e.g.
        # http://127.0.0.1:4416 locally, or a deployed service's URL). When
        # set, yt-dlp fetches a fresh PO token per request instead of relying
        # on cookies from a specific account.
        self.ytdlp_pot_provider_url: str = os.environ.get("YTDLP_POT_PROVIDER_URL", "").strip()
        # Emit yt-dlp's full internal debug trace (which client/PO-token path
        # was tried and why it failed) into the app logger for one stream
        # request. Verbose, so leave off unless actively debugging.
        self.ytdlp_verbose_logging: bool = os.environ.get(
            "YTDLP_VERBOSE_LOGGING", ""
        ).strip().lower() in ("1", "true", "yes")

        # --- AI providers ---
        self.ai_provider: str = os.environ.get("AI_PROVIDER", "qwen").strip().lower()
        self.ai_model: str = os.environ.get("AI_MODEL", "qwen2.5").strip()
        self.ai_timeout_seconds: float = float(os.environ.get("AI_TIMEOUT_SECONDS", "30"))
        self.ai_max_retries: int = int(os.environ.get("AI_MAX_RETRIES", "2"))
        self.qwen_base_url: str = os.environ.get("QWEN_BASE_URL", "http://localhost:11434/v1").rstrip("/")
        self.qwen_api_key: str = os.environ.get("QWEN_API_KEY", "")
        self.gemini_api_key: str = os.environ.get("GEMINI_API_KEY", "")
        self.gemini_model: str = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash").strip()

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
