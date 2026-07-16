from __future__ import annotations

import logging
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from fastapi import Depends

from dotenv import load_dotenv
from fastapi import APIRouter, Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, EmailStr, Field

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# --- fail fast in prod on missing secret ---
is_production = os.environ.get("APP_ENV", "development").lower() == "production"
has_no_jwt_secret = not os.environ.get("JWT_SECRET", "").strip()

if is_production and has_no_jwt_secret:
    raise RuntimeError("JWT_SECRET must be set in production")

from analytics_service import build_analytics_router  # noqa: E402
from auth import create_user, current_user, make_token, verify_password  # noqa: E402
from db import ensure_indexes, get_db  # noqa: E402
from search_service import search_songs  # noqa: E402
from services.queue import build_queue_manager  # noqa: E402
from song_utils import (build_local_song_doc, normalize_artist, normalize_title,  # noqa: E402
                        song_json)
from youtube_client import get_youtube_client  # noqa: E402

logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s %(levelname)s %(name)s %(message)s")
log = logging.getLogger("music")

app = FastAPI(title="Music API")
api = APIRouter(prefix="/api")

# --- health ---
@api.get("/")
def root():
    return {"status": "ok", "service": "music-api"}


# ================= AUTH =================
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    display_name: str | None = None


class LoginIn(BaseModel):
    email: EmailStr
    password: str


@api.post("/auth/register")
def register(body: RegisterIn):
    user = create_user(body.email, body.password, body.display_name)
    return {"token": make_token(user["id"]), "user": user}


@api.post("/auth/login")
def login(body: LoginIn):
    db = get_db()
    u = db.users.find_one({"email": body.email.lower()}, {"_id": 0})
    if not u or not verify_password(body.password, u.get("password_hash", "")):
        raise HTTPException(401, "Invalid credentials")
    safe = {k: v for k, v in u.items() if k != "password_hash"}
    return {"token": make_token(u["id"]), "user": safe}


@api.get("/auth/me")
def me(user=Depends(current_user)):
    return {"user": user}


# ================= SEARCH =================
@api.get("/songs/search")
def songs_search(q: str = Query(..., min_length=1, max_length=120),
                 user=Depends(current_user)):
    return search_songs(query=q, user_id=user["id"], yt=get_youtube_client())


# ================= MATERIALIZE =================
class MaterializeIn(BaseModel):
    yt_video_id: str = Field(min_length=11, max_length=11)
    title: str
    artist: str
    album: str = ""
    artwork_url: str = ""
    duration_sec: int | None = None


@api.post("/songs/materialize")
def materialize(body: MaterializeIn, user=Depends(current_user)):
    """First-write-wins for canonical catalog fields.

    Any user's submission ONLY writes canonical (title/artist/album/artwork)
    on insert. Later submissions are recorded per-user in ``song_submissions``
    but never overwrite the shared catalog row.
    """
    db = get_db()
    existing = db.songs.find_one({"yt_video_id": body.yt_video_id}, {"_id": 0})
    if existing:
        db.song_submissions.update_one(
            {"song_id": existing["id"], "user_id": user["id"]},
            {"$set": {"submitted_at": datetime.now(timezone.utc).isoformat(),
                      "title": body.title, "artist": body.artist,
                      "album": body.album, "artwork_url": body.artwork_url}},
            upsert=True,
        )
        return {"song": song_json(existing), "created": False}
    doc = build_local_song_doc(
        yt_video_id=body.yt_video_id, title=body.title, artist=body.artist,
        album=body.album, artwork_url=body.artwork_url, duration_sec=body.duration_sec,
    )
    doc["created_by"] = user["id"]
    try:
        db.songs.insert_one(doc)
    except Exception:
        existing = db.songs.find_one({"yt_video_id": body.yt_video_id}, {"_id": 0})
        if existing:
            return {"song": song_json(existing), "created": False}
        raise
    return {"song": song_json(doc), "created": True}


# ================= STREAM =================
@api.get("/songs/stream/{song_id}")
def stream(song_id: str, user=Depends(current_user)):
    db = get_db()
    yt_id: str | None = None
    if song_id.startswith("external:"):
        yt_id = song_id.split(":", 1)[1]
    else:
        row = db.songs.find_one({"id": song_id}, {"_id": 0, "yt_video_id": 1})
        if not row:
            raise HTTPException(404, "song not found")
        yt_id = row.get("yt_video_id")
    if not yt_id:
        raise HTTPException(404, "no yt_video_id for song")
    stream = get_youtube_client().resolve_stream(yt_id)
    if not stream:
        raise HTTPException(502, "failed to resolve stream")
    url, headers = stream
    return {"stream_url": url, "headers": headers, "yt_video_id": yt_id}


# ================= QUEUE / RADIO =================
class QueueGenIn(BaseModel):
    seed_song_id: str
    size: int = 25


@api.post("/queue/generate")
def queue_generate(body: QueueGenIn, user=Depends(current_user)):
    qm = build_queue_manager()
    items = qm.create_queue(
        seed_song_id=body.seed_song_id, user_id=user["id"], size=body.size,
    )
    return {
        "songs": [song_json(item) for item in items],
        "seed_song_id": body.seed_song_id,
        "size": len(items),
    }


# ================= HOME FEED =================
@api.get("/home/feed")
def home_feed(user=Depends(current_user)):
    db = get_db()
    yt = get_youtube_client()
    # Recently played
    recent = list(db.recently_played.find({"user_id": user["id"]}, {"_id": 0})
                  .sort("played_at", -1).limit(15))
    recent_songs = []
    for r in recent:
        row = db.songs.find_one({"id": r["song_id"]}, {"_id": 0})
        if row:
            recent_songs.append(song_json(row))
    # Top artists
    top_artists = list(db.user_artist_stats.find({"user_id": user["id"]}, {"_id": 0})
                       .sort("play_count", -1).limit(5))
    made_for_you: list[dict] = []
    for a in top_artists:
        made_for_you += yt.search(f"{a['artist_norm']} best songs", limit=5)
    # Cold-start fallback
    if not made_for_you and not recent_songs:
        made_for_you = yt.search("top hits 2026", limit=15)
    # Serialize + dedupe
    seen: set[str] = set()
    made_out: list[dict] = []
    for r in made_for_you:
        vid = r.get("yt_video_id")
        if not vid or vid in seen:
            continue
        seen.add(vid)
        # prefer local copy if present
        local = db.songs.find_one({"yt_video_id": vid}, {"_id": 0})
        made_out.append(song_json(local or r))
    return {
        "recently_played": recent_songs,
        "made_for_you": made_out[:25],
        "top_artists": [{"name": a["artist_norm"], "play_count": a.get("play_count", 0)}
                        for a in top_artists],
    }


# ================= CATALOG / RELATED =================
@api.get("/catalog/related")
def catalog_related(song_id: str, size: int = 20, user=Depends(current_user)):
    qm = build_queue_manager()
    items = qm.create_queue(seed_song_id=song_id, user_id=user["id"], size=size)
    return {"songs": items}


# ================= LIBRARY =================
class LikeIn(BaseModel):
    song_id: str


@api.post("/library/likes")
def like_song(body: LikeIn, user=Depends(current_user)):
    db = get_db()
    db.likes.update_one(
        {"user_id": user["id"], "song_id": body.song_id},
        {"$setOnInsert": {"created_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    return {"ok": True}


@api.delete("/library/likes/{song_id}")
def unlike_song(song_id: str, user=Depends(current_user)):
    get_db().likes.delete_one({"user_id": user["id"], "song_id": song_id})
    return {"ok": True}


@api.get("/library/likes")
def list_likes(user=Depends(current_user)):
    db = get_db()
    liked_ids = [d["song_id"] for d in db.likes.find({"user_id": user["id"]}, {"_id": 0})]
    songs = list(db.songs.find({"id": {"$in": liked_ids}}, {"_id": 0}))
    return {"songs": [song_json(s) for s in songs]}


@api.get("/library/recently-played")
def recently_played(user=Depends(current_user)):
    db = get_db()
    rp = list(db.recently_played.find({"user_id": user["id"]}, {"_id": 0})
              .sort("played_at", -1).limit(50))
    ids = [r["song_id"] for r in rp]
    songs_map = {s["id"]: s for s in db.songs.find({"id": {"$in": ids}}, {"_id": 0})}
    out = [song_json(songs_map[i]) for i in ids if i in songs_map]
    return {"songs": out}


class RecentIn(BaseModel):
    song_id: str


@api.post("/library/recently-played")
def add_recent(body: RecentIn, user=Depends(current_user)):
    db = get_db()
    db.recently_played.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "song_id": body.song_id,
        "played_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"ok": True}


# ================= PLAYLISTS =================
class PlaylistCreateIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str = ""


class PlaylistUpdateIn(BaseModel):
    name: str | None = None
    description: str | None = None
    song_ids: list[str] | None = None


@api.post("/playlists")
def playlist_create(body: PlaylistCreateIn, user=Depends(current_user)):
    db = get_db()
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": str(uuid.uuid4()),
        "owner_id": user["id"],
        "name": body.name,
        "description": body.description,
        "song_ids": [],
        "created_at": now,
        "updated_at": now,
    }
    db.playlists.insert_one(doc)
    doc.pop("_id", None)
    return {"playlist": doc}


@api.get("/playlists")
def playlist_list(user=Depends(current_user)):
    db = get_db()
    ps = list(db.playlists.find({"owner_id": user["id"]}, {"_id": 0}).sort("updated_at", -1))
    return {"playlists": ps}


@api.get("/playlists/{pid}")
def playlist_get(pid: str, user=Depends(current_user)):
    db = get_db()
    p = db.playlists.find_one({"id": pid, "owner_id": user["id"]}, {"_id": 0})
    if not p:
        raise HTTPException(404, "playlist not found")
    songs = list(db.songs.find({"id": {"$in": p.get("song_ids", [])}}, {"_id": 0}))
    smap = {s["id"]: s for s in songs}
    p["songs"] = [song_json(smap[i]) for i in p.get("song_ids", []) if i in smap]
    return {"playlist": p}


@api.patch("/playlists/{pid}")
def playlist_update(pid: str, body: PlaylistUpdateIn, user=Depends(current_user)):
    db = get_db()
    sets: dict[str, Any] = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if body.name is not None: sets["name"] = body.name
    if body.description is not None: sets["description"] = body.description
    if body.song_ids is not None: sets["song_ids"] = body.song_ids
    res = db.playlists.update_one({"id": pid, "owner_id": user["id"]}, {"$set": sets})
    if res.matched_count == 0:
        raise HTTPException(404, "playlist not found")
    return {"ok": True}


@api.delete("/playlists/{pid}")
def playlist_delete(pid: str, user=Depends(current_user)):
    res = get_db().playlists.delete_one({"id": pid, "owner_id": user["id"]})
    if res.deleted_count == 0:
        raise HTTPException(404, "playlist not found")
    return {"ok": True}


# ================= PROFILE STATS =================from 
@api.get("/profile/stats")
def profile_stats(user=Depends(current_user), db=Depends(get_db)):
    user_id = user["id"]  # Storing this in a variable saves repetitive typing
    
    # Wrapped in parentheses so the multi-line addition works seamlessly
    total_plays = (
        db.plays.count_documents({"user_id": user_id}) 
        + db.interaction_events.count_documents({"user_id": user_id, "type": "play"})
    )
    
    # Cleaned up line breaks for readability
    top_artists = list(
        db.user_artist_stats.find({"user_id": user_id}, {"_id": 0})
        .sort("play_count", -1)
        .limit(10)
    )
    
    top_songs = list(
        db.user_song_stats.find({"user_id": user_id}, {"_id": 0})
        .sort("play_count", -1)
        .limit(10)
    )
    
    return {
        "total_plays": total_plays,
        "likes": db.likes.count_documents({"user_id": user_id}),
        "playlists": db.playlists.count_documents({"owner_id": user_id}),
        "top_artists": top_artists,
        "top_songs": top_songs,
    }

# --- register analytics + main api ---
api.include_router(build_analytics_router())
app.include_router(api)

# Also expose /api at root path handler for platform health checks
@app.get("/")
def root_redirect():
    return RedirectResponse(url="/api/")


app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _startup():
    try:
        ensure_indexes()
        log.info("Mongo indexes ensured")
    except Exception as e:  # noqa: BLE001
        log.warning("Index setup failed (non-fatal): %s", e)
# "
# Observation: Overwrite successful: /app/backend/server.py
