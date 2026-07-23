"""AI DJ endpoints.

Purely additive: no existing route, request shape or response envelope changes.
A client that never calls ``/dj/*`` behaves exactly as it did before.

Handlers are plain ``def`` (not ``async``) so FastAPI runs the blocking PyMongo
and provider calls in its threadpool — the convention used throughout this API.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import get_current_user, get_dj_controller, get_dj_insight_service
from app.domain import song_json
from app.schemas.dj import DJAdvanceIn, DJConfigIn, DJObserveIn, DJStartIn
from app.services.dj import DJController, DJCycle, InsightService

router = APIRouter(prefix="/dj", tags=["dj"])


@router.get("/config")
def dj_get_config(
    user=Depends(get_current_user),
    dj: DJController = Depends(get_dj_controller),
):
    return {"config": dj.get_config(user["id"]).to_document()}


@router.put("/config")
def dj_update_config(
    body: DJConfigIn,
    user=Depends(get_current_user),
    dj: DJController = Depends(get_dj_controller),
):
    updated = dj.update_config(user["id"], body.model_dump(exclude_none=True))
    return {"config": updated.to_document()}


@router.post("/session/start")
def dj_start_session(
    body: DJStartIn,
    user=Depends(get_current_user),
    dj: DJController = Depends(get_dj_controller),
):
    """Open a session and return its opening queue."""
    cycle = dj.start(user["id"], body.seed_song_id, local_hour=body.local_hour)
    return _cycle_response(cycle)


@router.post("/session/{session_id}/observe")
def dj_observe(
    session_id: str,
    body: DJObserveIn,
    user=Depends(get_current_user),
    dj: DJController = Depends(get_dj_controller),
):
    """Report a track outcome and receive the DJ's response to it.

    ``refreshed`` tells the client whether ``songs`` carries a new queue. Most
    observations do not trigger a rebuild, which is the point — the DJ reacts
    when reacting is warranted, not on every track.
    """
    completion = min(body.listened_seconds / body.duration_seconds, 1.0)
    cycle = dj.observe(
        user["id"],
        session_id,
        song_id=body.song_id,
        reason=body.reason,  # type: ignore[arg-type]
        completion=completion,
        current_song_id=body.current_song_id,
        local_hour=body.local_hour,
    )
    if cycle is None:
        raise HTTPException(status_code=404, detail="DJ session not found")
    return _cycle_response(cycle)


@router.post("/session/{session_id}/advance")
def dj_advance(
    session_id: str,
    body: DJAdvanceIn,
    user=Depends(get_current_user),
    dj: DJController = Depends(get_dj_controller),
):
    """Ask the DJ to reconsider the queue without reporting a reaction."""
    cycle = dj.advance(
        user["id"],
        session_id,
        current_song_id=body.current_song_id,
        local_hour=body.local_hour,
        force_refresh=body.force_refresh,
    )
    if cycle is None:
        raise HTTPException(status_code=404, detail="DJ session not found")
    return _cycle_response(cycle)


@router.get("/session/{session_id}")
def dj_get_session(
    session_id: str,
    local_hour: int | None = None,
    user=Depends(get_current_user),
    dj: DJController = Depends(get_dj_controller),
):
    """Current session state and the signals the DJ is acting on."""
    session = dj.get_session(user["id"], session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="DJ session not found")
    ctx = dj.build_context(session, local_hour=local_hour)
    return {
        "session": {
            "id": session.id,
            "started_at": session.started_at,
            "queue_version": session.queue_version,
            "metrics": session.metrics,
            "config": session.config.to_document(),
            "strategy": session.strategy,
        },
        "signals": {
            "skip_rate": ctx.skip_rate,
            "completion_rate": ctx.completion_rate,
            "replay_rate": ctx.replay_rate,
            "skip_streak": ctx.skip_streak,
            "energy": ctx.current_energy,
            "energy_trend": ctx.energy_trend,
            "artist_saturation": ctx.artist_saturation,
            "dominant_artist": ctx.dominant_artist,
            "tracks_played": ctx.tracks_played,
            "elapsed_minutes": ctx.elapsed_minutes,
            "time_of_day": ctx.time_of_day,
        },
    }


@router.get("/session/{session_id}/insights")
def dj_insights(
    session_id: str,
    local_hour: int | None = None,
    user=Depends(get_current_user),
    dj: DJController = Depends(get_dj_controller),
    insights: InsightService = Depends(get_dj_insight_service),
):
    """A natural-language read on the session.

    This is the only DJ endpoint that may call a language model, and it is
    never on the playback path. It degrades to a deterministic summary when no
    provider is configured or the call fails.
    """
    session = dj.get_session(user["id"], session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="DJ session not found")
    ctx = dj.build_context(session, local_hour=local_hour)
    return {"insight": insights.generate(ctx).to_document()}


@router.post("/session/{session_id}/end")
def dj_end_session(
    session_id: str,
    user=Depends(get_current_user),
    dj: DJController = Depends(get_dj_controller),
):
    if not dj.end(user["id"], session_id):
        raise HTTPException(status_code=404, detail="DJ session not found")
    return {"ok": True}


def _cycle_response(cycle: DJCycle) -> dict:
    """Serialize a cycle, normalizing songs through the canonical wire shape."""
    payload = cycle.to_response()
    if payload.get("songs") is not None:
        payload["songs"] = [song_json(song) for song in payload["songs"]]
    return payload
