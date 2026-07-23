"""Access to AI DJ state: ``dj_sessions`` + ``dj_settings``.

Two collections, both additive — no existing collection or field is modified:

``dj_settings``
    One document per user holding their :class:`~app.services.dj.config.DJConfig`.

``dj_sessions``
    One document per DJ listening session. Holds the rolling observation log,
    per-artist play counts, the active strategy, and narration bookkeeping.

Writes are single atomic updates so a session can be advanced from concurrent
requests (a skip landing while a refresh is in flight) without read-modify-write
races. The observation log is bounded server-side via ``$slice`` so a long
session can never grow an unbounded document.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from pymongo import DESCENDING, ReturnDocument
from pymongo.database import Database

#: Newest-N observations retained per session. Enough for trend detection
#: (skip streaks, energy drift) without unbounded document growth.
MAX_OBSERVATIONS = 60


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class DJRepository:
    def __init__(self, db: Database) -> None:
        self._sessions = db.dj_sessions
        self._settings = db.dj_settings

    # --- settings ---
    def get_settings(self, user_id: str) -> dict[str, Any] | None:
        row = self._settings.find_one({"user_id": user_id}, {"_id": 0})
        return (row or {}).get("config")

    def save_settings(self, user_id: str, config: dict[str, Any]) -> None:
        self._settings.update_one(
            {"user_id": user_id},
            {"$set": {"config": config, "updated_at": _now_iso()}},
            upsert=True,
        )

    # --- sessions ---
    def create_session(
        self, user_id: str, seed_song_id: str, config: dict[str, Any]
    ) -> dict[str, Any]:
        doc: dict[str, Any] = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "seed_song_id": seed_song_id,
            "config": config,
            "started_at": _now_iso(),
            "updated_at": _now_iso(),
            "ended_at": None,
            "observations": [],
            "played_song_ids": [],
            "artist_counts": {},
            "strategy": None,
            "narration": {"count": 0, "last_at": None, "recent": []},
            "queue_version": 0,
            "metrics": {"tracks": 0, "skips": 0, "completions": 0, "replays": 0},
        }
        self._sessions.insert_one(dict(doc))
        doc.pop("_id", None)
        return doc

    def get_session(self, session_id: str, user_id: str) -> dict[str, Any] | None:
        return self._sessions.find_one(
            {"id": session_id, "user_id": user_id}, {"_id": 0}
        )

    def latest_active_session(self, user_id: str) -> dict[str, Any] | None:
        return self._sessions.find_one(
            {"user_id": user_id, "ended_at": None},
            {"_id": 0},
            sort=[("started_at", DESCENDING)],
        )

    def append_observation(
        self,
        session_id: str,
        user_id: str,
        observation: dict[str, Any],
        *,
        metric_increments: dict[str, int],
        artist_norm: str | None,
    ) -> dict[str, Any] | None:
        """Record one track outcome and return the updated session.

        A single atomic update performs all of: append (bounded) to the
        observation log, de-duplicated append to the played-song list,
        per-artist counter increment, and metric roll-up.
        """
        increments: dict[str, int] = {
            f"metrics.{name}": value for name, value in metric_increments.items()
        }
        if artist_norm:
            # Dots in a Mongo key would be read as a path separator.
            increments[f"artist_counts.{_escape_key(artist_norm)}"] = 1

        ops: dict[str, Any] = {
            "$push": {
                "observations": {
                    "$each": [observation],
                    "$slice": -MAX_OBSERVATIONS,
                }
            },
            "$set": {"updated_at": _now_iso()},
        }
        if increments:
            ops["$inc"] = increments
        song_id = observation.get("song_id")
        if song_id:
            ops["$addToSet"] = {"played_song_ids": song_id}

        return self._sessions.find_one_and_update(
            {"id": session_id, "user_id": user_id},
            ops,
            projection={"_id": 0},
            return_document=ReturnDocument.AFTER,
        )

    def save_decision(
        self,
        session_id: str,
        user_id: str,
        *,
        strategy: dict[str, Any],
        narration: dict[str, Any] | None,
    ) -> None:
        """Persist the outcome of one DJ decision cycle."""
        ops: dict[str, Any] = {
            "$set": {"strategy": strategy, "updated_at": _now_iso()},
            "$inc": {"queue_version": 1},
        }
        if narration:
            ops["$set"]["narration.last_at"] = _now_iso()
            ops["$set"]["narration.last_kind"] = narration.get("kind")
            ops["$inc"]["narration.count"] = 1
            ops["$push"] = {
                "narration.recent": {"$each": [narration.get("text", "")], "$slice": -8}
            }
        self._sessions.update_one({"id": session_id, "user_id": user_id}, ops)

    def end_session(self, session_id: str, user_id: str) -> bool:
        result = self._sessions.update_one(
            {"id": session_id, "user_id": user_id, "ended_at": None},
            {"$set": {"ended_at": _now_iso(), "updated_at": _now_iso()}},
        )
        return result.matched_count > 0

    def recent_sessions(self, user_id: str, limit: int = 5) -> list[dict[str, Any]]:
        return list(
            self._sessions.find({"user_id": user_id}, {"_id": 0, "observations": 0})
            .sort("started_at", DESCENDING)
            .limit(limit)
        )


def _escape_key(value: str) -> str:
    """Make ``value`` safe as a MongoDB field name."""
    return value.replace(".", "．").replace("$", "＄")


def unescape_key(value: str) -> str:
    """Inverse of :func:`_escape_key`, for reading ``artist_counts`` back."""
    return value.replace("．", ".").replace("＄", "$")
