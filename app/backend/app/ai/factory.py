from __future__ import annotations
from functools import lru_cache
from app.ai.providers import GeminiProvider, OpenAICompatibleProvider
from app.ai.types import AIProvider
from app.core.config import get_settings
@lru_cache(maxsize=1)
def get_ai_client() -> AIProvider:
    s = get_settings()
    if s.ai_provider == "gemini":
        return GeminiProvider(s.gemini_model, s.ai_timeout_seconds, s.ai_max_retries)
    if s.ai_provider != "qwen": raise RuntimeError(f"Configure an adapter for AI_PROVIDER={s.ai_provider}")
    return OpenAICompatibleProvider("qwen", s.qwen_base_url, s.qwen_api_key, s.ai_model, s.ai_timeout_seconds, s.ai_max_retries)
