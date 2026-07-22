from __future__ import annotations
from dataclasses import dataclass
from typing import AsyncIterator, Literal
Role = Literal["system", "user", "assistant"]
@dataclass(frozen=True)
class AIMessage: role: Role; content: str
@dataclass(frozen=True)
class AIResponse: text: str; provider: str; model: str
class AIProviderError(RuntimeError): pass
class AIProvider:
    name: str
    async def complete(self, messages: list[AIMessage], *, model: str | None = None) -> AIResponse: raise NotImplementedError
    async def stream(self, messages: list[AIMessage], *, model: str | None = None) -> AsyncIterator[str]: yield (await self.complete(messages, model=model)).text
