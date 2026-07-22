from __future__ import annotations
import asyncio, json
from urllib import error, request
from app.ai.types import AIMessage, AIProvider, AIProviderError, AIResponse
class OpenAICompatibleProvider(AIProvider):
    """Works with Qwen/Ollama/vLLM and compatible cloud providers."""
    def __init__(self, name: str, base_url: str, api_key: str, default_model: str, timeout: float, retries: int): self.name, self.base_url, self.api_key, self.default_model, self.timeout, self.retries = name, base_url.rstrip("/"), api_key, default_model, timeout, retries
    async def complete(self, messages: list[AIMessage], *, model: str | None = None) -> AIResponse:
        chosen = model or self.default_model; payload = {"model": chosen, "messages": [m.__dict__ for m in messages]}; headers = {"Content-Type": "application/json"}
        if self.api_key: headers["Authorization"] = f"Bearer {self.api_key}"
        def send():
            req = request.Request(f"{self.base_url}/chat/completions", data=json.dumps(payload).encode(), headers=headers)
            with request.urlopen(req, timeout=self.timeout) as response: return json.loads(response.read())
        for attempt in range(self.retries + 1):
            try:
                data = await asyncio.to_thread(send); return AIResponse(data["choices"][0]["message"]["content"], self.name, chosen)
            except (error.URLError, error.HTTPError, KeyError, IndexError, json.JSONDecodeError) as exc:
                if attempt == self.retries: raise AIProviderError(f"{self.name} request failed") from exc
                await asyncio.sleep(.25 * (2 ** attempt))


class GeminiProvider(AIProvider):
    """Gemini REST adapter with the same retry/timeout contract as local AI."""
    name = "gemini"
    def __init__(self, api_key: str, default_model: str, timeout: float, retries: int):
        self.api_key, self.default_model, self.timeout, self.retries = api_key, default_model, timeout, retries
    async def complete(self, messages: list[AIMessage], *, model: str | None = None) -> AIResponse:
        if not self.api_key:
            raise AIProviderError("GEMINI_API_KEY is not configured")
        chosen = model or self.default_model
        prompt = "\n\n".join(f"{m.role.upper()}: {m.content}" for m in messages)
        payload = {"contents": [{"role": "user", "parts": [{"text": prompt}]}]}
        def send():
            url = (
                f"https://generativelanguage.googleapis.com/v1/models/"
                f"{chosen}:generateContent"
            )
            
            print(url)
            print(chosen)

            req = request.Request(
                url,
                data=json.dumps(payload).encode(),
                headers={
                    "Content-Type": "application/json",
                    "x-goog-api-key": self.api_key,
                },
            )

            try:
                with request.urlopen(req, timeout=self.timeout) as response:
                    body = response.read().decode()
                    print(body)
                    return json.loads(body)

            except error.HTTPError as e:
                print("STATUS:", e.code)
                print(e.read().decode())
                raise
        for attempt in range(self.retries + 1):
            try:
                data = await asyncio.to_thread(send)
                text = data["candidates"][0]["content"]["parts"][0]["text"]
                return AIResponse(text, self.name, chosen)
            except (error.URLError, error.HTTPError, KeyError, IndexError, json.JSONDecodeError) as exc:
                if attempt == self.retries: raise AIProviderError("Gemini request failed") from exc
                await asyncio.sleep(.25 * (2 ** attempt))
