"""Access to the ``search_history`` collection."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from pymongo.database import Database


class SearchHistoryRepository:
    def __init__(self, db: Database) -> None:
        self._history = db.search_history

    def record(
        self, search_id: str, user_id: str, query: str, result_count: int
    ) -> None:
        self._history.insert_one({
            "id": search_id,
            "user_id": user_id,
            "query": query,
            "result_count": result_count,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

    def recent_queries(self, user_id: str, limit: int = 100) -> list[dict[str, Any]]:
        return list(
            self._history.find({"user_id": user_id}, {"_id": 0, "query": 1})
            .sort("created_at", -1)
            .limit(limit)
        )
