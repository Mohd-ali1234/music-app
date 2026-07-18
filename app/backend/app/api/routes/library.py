from __future__ import annotations

from fastapi import APIRouter, Depends

from app.api.deps import (
    get_current_user,
    get_library_repository,
    get_song_repository,
)
from app.domain import song_json
from app.repositories import LibraryRepository, SongRepository
from app.schemas.library import LikeIn, RecentIn

router = APIRouter(prefix="/library", tags=["library"])


@router.post("/likes")
def like_song(
    body: LikeIn,
    user=Depends(get_current_user),
    library: LibraryRepository = Depends(get_library_repository),
):
    library.add_like(user["id"], body.song_id)
    return {"ok": True}


@router.delete("/likes/{song_id}")
def unlike_song(
    song_id: str,
    user=Depends(get_current_user),
    library: LibraryRepository = Depends(get_library_repository),
):
    library.remove_like(user["id"], song_id)
    return {"ok": True}


@router.get("/likes")
def list_likes(
    user=Depends(get_current_user),
    library: LibraryRepository = Depends(get_library_repository),
    songs: SongRepository = Depends(get_song_repository),
):
    liked_ids = library.liked_song_ids(user["id"])
    rows = songs.list_by_ids(liked_ids)
    return {"songs": [song_json(s) for s in rows]}


@router.get("/recently-played")
def recently_played(
    user=Depends(get_current_user),
    library: LibraryRepository = Depends(get_library_repository),
    songs: SongRepository = Depends(get_song_repository),
):
    entries = library.recent_entries(user["id"], limit=50)
    ids = [e["song_id"] for e in entries]
    songs_by_id = songs.map_by_ids(ids)
    ordered = [song_json(songs_by_id[i]) for i in ids if i in songs_by_id]
    return {"songs": ordered}


@router.post("/recently-played")
def add_recent(
    body: RecentIn,
    user=Depends(get_current_user),
    library: LibraryRepository = Depends(get_library_repository),
):
    library.add_recent(user["id"], body.song_id)
    return {"ok": True}
