"""Access to the ``playlists`` collection (owner-scoped)."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from pymongo.database import Database


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class PlaylistRepository:
    def __init__(self, db: Database) -> None:
        self._playlists = db.playlists

    def create(self, owner_id: str, name: str, description: str) -> dict[str, Any]:
        now = _now_iso()
        doc = {
            "id": str(uuid.uuid4()),
            "owner_id": owner_id,
            "name": name,
            "description": description,
            "song_ids": [],
            "created_at": now,
            "updated_at": now,
        }
        self._playlists.insert_one(doc)
        doc.pop("_id", None)
        return doc

    def count_for_owner(self, owner_id: str) -> int:
        return self._playlists.count_documents({"owner_id": owner_id})

    def list_for_owner(self, owner_id: str) -> list[dict[str, Any]]:
        return list(
            self._playlists.find({"owner_id": owner_id}, {"_id": 0})
            .sort("updated_at", -1)
        )

    def get_owned(self, playlist_id: str, owner_id: str) -> dict[str, Any] | None:
        return self._playlists.find_one(
            {"id": playlist_id, "owner_id": owner_id}, {"_id": 0}
        )

    def update_owned(
        self, playlist_id: str, owner_id: str, fields: dict[str, Any]
    ) -> int:
        """Apply ``fields`` (plus a fresh ``updated_at``) to an owned playlist.

        Returns the matched count so callers can surface a 404.
        """
        to_set = {**fields, "updated_at": _now_iso()}
        result = self._playlists.update_one(
            {"id": playlist_id, "owner_id": owner_id}, {"$set": to_set}
        )
        return result.matched_count

    def delete_owned(self, playlist_id: str, owner_id: str) -> int:
        result = self._playlists.delete_one(
            {"id": playlist_id, "owner_id": owner_id}
        )
        return result.deleted_count
