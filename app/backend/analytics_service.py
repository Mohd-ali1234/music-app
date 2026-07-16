from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from auth import current_user
from db import get_db


class SessionStart(BaseModel):
    device: str | None = None
    context: str | None = None  # "search"|"radio"|"playlist"|"library"


class SessionHeartbeat(BaseModel):
    session_id: str
    song_id: str
    yt_video_id: str | None = None
    position_sec: int = 0
    artist_norm: str | None = None
    album_norm: str | None = None


class SessionEnd(BaseModel):
    session_id: str
    duration_sec: int = 0


class InteractionEvent(BaseModel):
    type: str = Field(..., description="play|pause|skip|like|unlike|queue_add|radio_start")
    song_id: str | None = None
    yt_video_id: str | None = None
    context: dict[str, Any] | None = None


def build_analytics_router() -> APIRouter:
    r = APIRouter(prefix="/analytics", tags=["analytics"])

    @r.post("/session/start")
    def session_start(body: SessionStart, user=Depends(current_user)):
        db = get_db()
        sid = str(uuid.uuid4())
        db.listening_sessions.insert_one({
            "id": sid,
            "user_id": user["id"],
            "device": body.device,
            "context": body.context,
            "started_at": datetime.now(timezone.utc).isoformat(),
            "song_ids": [],
            "song_yt_ids": [],
            "artist_norms": [],
            "album_norms": [],
        })
        return {"session_id": sid}

    @r.post("/session/heartbeat")
    def session_heartbeat(body: SessionHeartbeat, user=Depends(current_user)):
        db = get_db()
        sess = db.listening_sessions.find_one({"id": body.session_id, "user_id": user["id"]}, {"_id": 0})
        if not sess:
            raise HTTPException(404, "session not found")
        updates: dict[str, Any] = {}
        add_to_set: dict[str, Any] = {}
        if body.song_id and body.song_id not in (sess.get("song_ids") or []):
            add_to_set["song_ids"] = body.song_id
        if body.yt_video_id and body.yt_video_id not in (sess.get("song_yt_ids") or []):
            add_to_set["song_yt_ids"] = body.yt_video_id
        if body.artist_norm and body.artist_norm not in (sess.get("artist_norms") or []):
            add_to_set["artist_norms"] = body.artist_norm
        if body.album_norm and body.album_norm not in (sess.get("album_norms") or []):
            add_to_set["album_norms"] = body.album_norm
        ops: dict[str, Any] = {"$set": {"last_heartbeat_at": datetime.now(timezone.utc).isoformat()}}
        if add_to_set:
            ops["$addToSet"] = add_to_set
        db.listening_sessions.update_one({"id": body.session_id}, ops)
        # user_song_stats bump
        if body.song_id:
            db.user_song_stats.update_one(
                {"user_id": user["id"], "song_id": body.song_id},
                {"$inc": {"play_count": 0}, "$setOnInsert": {"created_at": datetime.now(timezone.utc).isoformat()}},
                upsert=True,
            )
        return {"ok": True}

    @r.post("/session/end")
    def session_end(body: SessionEnd, user=Depends(current_user)):
        db = get_db()
        db.listening_sessions.update_one(
            {"id": body.session_id, "user_id": user["id"]},
            {"$set": {"ended_at": datetime.now(timezone.utc).isoformat(),
                      "duration_sec": body.duration_sec}},
        )
        return {"ok": True}

    @r.post("/event")
    def event(body: InteractionEvent, user=Depends(current_user)):
        db = get_db()
        doc = {
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "type": body.type,
            "song_id": body.song_id,
            "yt_video_id": body.yt_video_id,
            "context": body.context or {},
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        db.interaction_events.insert_one(doc)
        # aggregate simple counters
        if body.type == "play" and body.song_id:
            db.user_song_stats.update_one(
                {"user_id": user["id"], "song_id": body.song_id},
                {"$inc": {"play_count": 1},
                 "$set": {"last_played_at": doc["created_at"]}},
                upsert=True,
            )
            song = db.songs.find_one({"id": body.song_id}, {"_id": 0, "artist_norm": 1, "album_norm": 1})
            if song:
                if song.get("artist_norm"):
                    db.user_artist_stats.update_one(
                        {"user_id": user["id"], "artist_norm": song["artist_norm"]},
                        {"$inc": {"play_count": 1}}, upsert=True,
                    )
                if song.get("album_norm"):
                    db.user_album_stats.update_one(
                        {"user_id": user["id"], "album_norm": song["album_norm"]},
                        {"$inc": {"play_count": 1}}, upsert=True,
                    )
        return {"ok": True, "event_id": doc["id"]}

    return r
