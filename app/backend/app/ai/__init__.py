"""Provider-neutral AI boundary; application code imports only get_ai_client."""
from app.ai.factory import get_ai_client
from app.ai.types import AIMessage, AIResponse

__all__ = ["AIMessage", "AIResponse", "get_ai_client"]
