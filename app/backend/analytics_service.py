import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel, Field
from pymongo import ReturnDocument

log = logging.getLogger(__name__)


def now():
    return datetime.now(timezone.utc)


class SessionStart(BaseModel):
    song_id: str
    playback_source: str = "unknown"
    device_platform: str = "unknown"
    app_version: str = "unknown"
    song_duration: float = Field(0, ge=0)
    start_position: float = Field(0, ge=0)


class SessionProgress(BaseModel):
    position: float = Field(0, ge=0)
    listened_seconds: float = Field(0, ge=0, le=120)


class SessionEnd(SessionProgress):
    reason: str = "stopped"


class Interaction(BaseModel):
    event_type: str
    song_id: str | None = None
    session_id: str | None = None
    current_position: float = Field(0, ge=0)
    metadata: dict = Field(default_factory=dict)


class SearchSelection(BaseModel):
    song_id: str
    selected_position: int = Field(ge=0)


EVENT_NAMES = {
    "song_played": "play", "song_paused": "pause", "song_resumed": "resume",
    "song_skipped": "skip", "song_completed": "complete", "song_replayed": "repeat",
    "added_to_playlist": "add_to_playlist", "removed_from_playlist": "remove_from_playlist",
}


def build_analytics_router(db, current_user, require_song):
    router = APIRouter(prefix="/analytics", tags=["analytics"])
    sessions, events = db.listening_sessions, db.interaction_events
    user_song, recent, searches = db.user_song_stats, db.recently_played, db.search_history

    def event(user_id, event_type, song_id=None, session_id=None, position=0, metadata=None):
        canonical = EVENT_NAMES.get(event_type, event_type)
        if event_type == "song_seeked":
            start = (metadata or {}).get("from_position", position)
            canonical = "seek_forward" if position >= start else "seek_backward"
        events.insert_one({
            "id": str(uuid.uuid4()), "user_id": user_id, "song_id": song_id,
            "session_id": session_id, "event_type": canonical, "timestamp": now(),
            "playback_position": position, "metadata": metadata or {},
        })

    def apply_statistics(session_id):
        """Idempotently aggregate one finalized session off the request path."""
        try:
            session = sessions.find_one_and_update(
                {"id": session_id, "status": "ended", "statistics_applied": False},
                {"$set": {"statistics_applied": True, "statistics_applied_at": now()}},
                return_document=ReturnDocument.AFTER,
            )
            if not session:
                return
            timestamp = session["ended_at"]
            listened = float(session.get("actual_listening_time_seconds") or 0)
            completion = float(session.get("completion_percentage") or 0)
            completed, skipped = bool(session.get("completed")), bool(session.get("skipped"))
            key = {"user_id": session["user_id"], "song_id": session["song_id"]}
            user_song.update_one(key, {
                "$inc": {"play_count": 1, "skip_count": int(skipped),
                         "total_listening_time": listened, "completion_percentage_total": completion},
                "$set": {"last_played": timestamp},
                "$setOnInsert": {"first_played": session["started_at"], "repeat_count": 0},
            }, upsert=True)
            stat = user_song.find_one(key, {"_id": 0})
            plays = max(int(stat.get("play_count", 1)), 1)
            user_song.update_one(key, {"$set": {
                "average_listening_time": float(stat.get("total_listening_time", 0)) / plays,
                "completion_percentage": float(stat.get("completion_percentage_total", 0)) / plays,
            }})
            recent.update_one(
                {"user_id": session["user_id"], "session_id": session_id},
                {"$setOnInsert": {"song_id": session["song_id"], "played_at": timestamp}}, upsert=True,
            )
            event(session["user_id"], "complete" if completed else "skip" if skipped else "stop",
                  session["song_id"], session_id, session.get("end_position", 0),
                  {"completion_percentage": completion})
        except Exception:
            # The marker remains false when claiming fails; operational retries
            # can safely invoke this function again.
            log.exception("Failed to aggregate listening session %s", session_id)

    @router.post("/sessions", status_code=201)
    def start(body: SessionStart, background_tasks: BackgroundTasks, user=Depends(current_user)):
        song = require_song(body.song_id)
        session_id, timestamp = str(uuid.uuid4()), now()
        sessions.insert_one({
            "id": session_id, "user_id": user["id"], "song_id": body.song_id,
            "started_at": timestamp, "ended_at": None,
            "song_duration": body.song_duration or song.get("duration", 0),
            "actual_listening_time_seconds": 0.0, "completion_percentage": 0.0,
            "start_position": body.start_position, "end_position": body.start_position,
            "playback_source": body.playback_source, "completed": False, "skipped": False,
            "hour_of_day": timestamp.hour, "day_of_week": timestamp.weekday(),
            "full_timestamp": timestamp, "device_platform": body.device_platform,
            "app_version": body.app_version, "status": "active", "statistics_applied": False,
            "created_at": timestamp, "updated_at": timestamp,
        })
        background_tasks.add_task(event, user["id"], "play", body.song_id, session_id, body.start_position)
        return {"session_id": session_id}

    @router.post("/sessions/{session_id}/heartbeat", status_code=204)
    def heartbeat(session_id: str, body: SessionProgress, user=Depends(current_user)):
        result = sessions.update_one(
            {"id": session_id, "user_id": user["id"], "status": "active"},
            {"$inc": {"actual_listening_time_seconds": body.listened_seconds},
             "$set": {"end_position": body.position, "updated_at": now()}},
        )
        if not result.matched_count:
            raise HTTPException(404, "Active listening session not found")

    @router.post("/sessions/{session_id}/end")
    def end(session_id: str, body: SessionEnd, background_tasks: BackgroundTasks, user=Depends(current_user)):
        timestamp = now()
        session = sessions.find_one_and_update(
            {"id": session_id, "user_id": user["id"], "status": "active"},
            {"$inc": {"actual_listening_time_seconds": body.listened_seconds}, "$set": {
                "end_position": body.position, "ended_at": timestamp, "status": "ended",
                "end_reason": body.reason, "updated_at": timestamp}},
            return_document=ReturnDocument.AFTER,
        )
        if not session:
            existing = sessions.find_one({"id": session_id, "user_id": user["id"]})
            if existing and existing.get("status") == "ended":
                return {"session_id": session_id, "already_finalized": True}
            raise HTTPException(404, "Listening session not found")
        duration = float(session.get("song_duration") or 0)
        listened = float(session.get("actual_listening_time_seconds") or 0)
        completion = min(100.0, listened / duration * 100) if duration else 0.0
        completed = body.reason == "completed" or completion >= 90
        skipped = body.reason == "skipped"
        sessions.update_one({"id": session_id}, {"$set": {
            "completion_percentage": completion, "completed": completed, "skipped": skipped}})
        background_tasks.add_task(apply_statistics, session_id)
        return {"session_id": session_id, "actual_listening_time_seconds": listened,
                "completion_percentage": completion, "completed": completed, "skipped": skipped}

    @router.post("/events", status_code=204)
    def track(body: Interaction, background_tasks: BackgroundTasks, user=Depends(current_user)):
        background_tasks.add_task(event, user["id"], body.event_type, body.song_id,
                                  body.session_id, body.current_position, body.metadata)
        if body.song_id and EVENT_NAMES.get(body.event_type, body.event_type) == "repeat":
            background_tasks.add_task(user_song.update_one,
                {"user_id": user["id"], "song_id": body.song_id}, {"$inc": {"repeat_count": 1}}, True)

    @router.post("/searches/{search_id}/select", status_code=204)
    def select(search_id: str, body: SearchSelection, background_tasks: BackgroundTasks,
               user=Depends(current_user)):
        background_tasks.add_task(searches.update_one,
            {"id": search_id, "user_id": user["id"]}, {"$set": {
                "selected_song_id": body.song_id, "selected_position": body.selected_position,
                "selected_at": now()}})

    return router
