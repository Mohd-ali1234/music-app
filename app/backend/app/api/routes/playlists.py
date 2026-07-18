from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import (
    get_current_user,
    get_playlist_repository,
    get_song_repository,
)
from app.domain import song_json
from app.repositories import PlaylistRepository, SongRepository
from app.schemas.playlist import PlaylistCreateIn, PlaylistUpdateIn

router = APIRouter(prefix="/playlists", tags=["playlists"])


@router.post("")
def playlist_create(
    body: PlaylistCreateIn,
    user=Depends(get_current_user),
    playlists: PlaylistRepository = Depends(get_playlist_repository),
):
    doc = playlists.create(user["id"], body.name, body.description)
    return {"playlist": doc}


@router.get("")
def playlist_list(
    user=Depends(get_current_user),
    playlists: PlaylistRepository = Depends(get_playlist_repository),
):
    return {"playlists": playlists.list_for_owner(user["id"])}


@router.get("/{pid}")
def playlist_get(
    pid: str,
    user=Depends(get_current_user),
    playlists: PlaylistRepository = Depends(get_playlist_repository),
    songs: SongRepository = Depends(get_song_repository),
):
    playlist = playlists.get_owned(pid, user["id"])
    if not playlist:
        raise HTTPException(status_code=404, detail="playlist not found")
    song_ids = playlist.get("song_ids", [])
    songs_by_id = songs.map_by_ids(song_ids)
    playlist["songs"] = [
        song_json(songs_by_id[i]) for i in song_ids if i in songs_by_id
    ]
    return {"playlist": playlist}


@router.patch("/{pid}")
def playlist_update(
    pid: str,
    body: PlaylistUpdateIn,
    user=Depends(get_current_user),
    playlists: PlaylistRepository = Depends(get_playlist_repository),
):
    fields: dict[str, Any] = {}
    if body.name is not None:
        fields["name"] = body.name
    if body.description is not None:
        fields["description"] = body.description
    if body.song_ids is not None:
        fields["song_ids"] = body.song_ids
    matched = playlists.update_owned(pid, user["id"], fields)
    if matched == 0:
        raise HTTPException(status_code=404, detail="playlist not found")
    return {"ok": True}


@router.delete("/{pid}")
def playlist_delete(
    pid: str,
    user=Depends(get_current_user),
    playlists: PlaylistRepository = Depends(get_playlist_repository),
):
    deleted = playlists.delete_owned(pid, user["id"])
    if deleted == 0:
        raise HTTPException(status_code=404, detail="playlist not found")
    return {"ok": True}
