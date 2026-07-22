from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import (
    get_current_user,
    get_ai_playlist_service,
    get_playlist_creation_service,
    get_playlist_repository,
    get_song_repository,
)
from app.domain import song_json
from app.repositories import PlaylistRepository, SongRepository
from app.schemas.playlist import PlaylistCreateIn, PlaylistFromPromptIn, PlaylistFromSearchesIn, PlaylistUpdateIn
from app.services.ai_playlist_service import AIPlaylistService
from app.services.playlist_creation_service import PlaylistCreationService

router = APIRouter(prefix="/playlists", tags=["playlists"])


@router.post("")
def playlist_create(
    body: PlaylistCreateIn,
    user=Depends(get_current_user),
    playlists: PlaylistRepository = Depends(get_playlist_repository),
):
    doc = playlists.create(user["id"], body.name, body.description)
    return {"playlist": doc}


@router.post("/from-searches")
def playlist_create_from_searches(
    body: PlaylistFromSearchesIn,
    user=Depends(get_current_user),
    service: PlaylistCreationService = Depends(get_playlist_creation_service),
):
    """Resolve up to 15 supplied song names, then create a playable playlist."""
    return service.create_from_searches(
        user_id=user["id"],
        name=body.name,
        description=body.description,
        song_queries=body.song_queries,
    )

@router.post("/from-prompt")
def playlist_create_from_prompt(
    body: PlaylistFromPromptIn,
    user=Depends(get_current_user),
    service: AIPlaylistService = Depends(get_ai_playlist_service),
):
    return service.create(user["id"], body.prompt, body.track_count)


@router.get("")
def playlist_list(
    user=Depends(get_current_user),
    playlists: PlaylistRepository = Depends(get_playlist_repository),
    songs: SongRepository = Depends(get_song_repository),
):
    docs = playlists.list_for_owner(user["id"])
    preview_ids = {sid for d in docs for sid in d.get("song_ids", [])[:4]}
    songs_by_id = songs.map_by_ids(preview_ids)

    result = []
    for d in docs:
        song_ids = d.get("song_ids", [])
        covers: list[str] = []
        for sid in song_ids:
            if len(covers) >= 4:
                break
            row = songs_by_id.get(sid)
            artwork = row and (row.get("artwork_url") or row.get("artwork"))
            if artwork:
                covers.append(artwork)
        result.append({**d, "song_count": len(song_ids), "cover_urls": covers})
    return {"playlists": result}


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
