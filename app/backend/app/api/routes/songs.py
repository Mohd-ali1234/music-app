from __future__ import annotations

from fastapi import APIRouter, Depends

from app.api.deps import get_current_user, get_song_service
from app.schemas.song import MaterializeIn
from app.services.song_service import SongService

router = APIRouter(tags=["songs"])


@router.post("/songs/materialize")
def materialize(
    body: MaterializeIn,
    user=Depends(get_current_user),
    songs: SongService = Depends(get_song_service),
):
    return songs.materialize(user["id"], body)


@router.get("/songs/stream/{song_id}")
def stream(
    song_id: str,
    user=Depends(get_current_user),
    songs: SongService = Depends(get_song_service),
):
    return songs.resolve_stream(song_id)
