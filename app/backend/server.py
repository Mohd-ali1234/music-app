import asyncio, hashlib, hmac, logging, os, re, secrets, time, uuid
from datetime import datetime, timedelta, timezone
from typing import Annotated, Optional

import jwt, yt_dlp
from dotenv import load_dotenv
from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, EmailStr, Field
from pymongo.errors import DuplicateKeyError
from pymongo import ASCENDING, DESCENDING, MongoClient, ReturnDocument
from analytics_service import build_analytics_router
from services.queue import build_queue_manager

load_dotenv()
log = logging.getLogger(__name__)
MONGO_URL = os.getenv("MONGODB_URL") or os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("MONGODB_DB") or os.getenv("DB_NAME", "music_player")
JWT_SECRET = os.getenv("JWT_SECRET", "change-this-secret-in-production")
client = MongoClient(MONGO_URL, serverSelectionTimeoutMS=5000)
db = client[DB_NAME]
users, songs, likes, plays, playlists = db.users, db.songs, db.likes, db.plays, db.playlists
search_history, recent_plays = db.search_history, db.recently_played

app = FastAPI(title="Music Player API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[x.strip() for x in os.getenv("CORS_ORIGINS", "http://localhost:8081,http://localhost:19006").split(",")],
    allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
)
bearer = HTTPBearer(auto_error=False)


class RegisterBody(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    name: Optional[str] = Field(None, max_length=80)


class LoginBody(BaseModel):
    email: EmailStr
    password: str


class PlaylistBody(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    created_from: str = Field(default="library", max_length=50)


class ExternalSongBody(BaseModel):
    yt_video_id: str = Field(min_length=3, max_length=30)
    title: str = Field(min_length=1, max_length=300)
    artist: str = Field(min_length=1, max_length=200)
    album: Optional[str] = Field(None, max_length=300)
    duration: int = Field(default=0, ge=0, le=7200)
    artwork: Optional[str] = Field(None, max_length=2000)


class PlaylistSongBody(BaseModel):
    song_id: str


def utcnow(): return datetime.now(timezone.utc)


def user_json(u):
    return {"id": u["id"], "email": u["email"], "name": u.get("name")}


def song_json(s):
    result = {"id": s["id"], "title": s.get("title", "Unknown"), "artist": s.get("artist", "Unknown Artist"),
            "album": s.get("album"), "duration": int(s.get("duration") or 0), "artwork": s.get("artwork"),
            "yt_video_id": s.get("yt_video_id")}
    if s.get("statistics") is not None:
        result["statistics"] = s["statistics"]
    return result


def password_hash(password, salt=None):
    salt = salt or secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 310_000)
    return f"{salt.hex()}:{digest.hex()}"


def password_ok(password, encoded):
    try:
        salt, expected = encoded.split(":", 1)
        actual = password_hash(password, bytes.fromhex(salt)).split(":", 1)[1]
        return hmac.compare_digest(actual, expected)
    except (ValueError, TypeError):
        return False


def token_for(user_id):
    return jwt.encode({"sub": user_id, "exp": utcnow() + timedelta(days=30)}, JWT_SECRET, algorithm="HS256")


def current_user(credentials: Annotated[Optional[HTTPAuthorizationCredentials], Depends(bearer)]):
    if not credentials:
        raise HTTPException(401, "Authentication required")
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=["HS256"])
        user = users.find_one({"id": payload["sub"]}, {"_id": 0})
    except (jwt.InvalidTokenError, KeyError):
        user = None
    if not user:
        raise HTTPException(401, "Invalid or expired token")
    return user


def require_song(song_id):
    song = songs.find_one({"id": song_id}, {"_id": 0})
    if not song: raise HTTPException(404, "Song not found")
    return song


app.include_router(build_analytics_router(db, current_user, require_song))


@app.on_event("startup")
def startup():
    client.admin.command("ping")
    users.create_index("email", unique=True)
    songs.create_index("id", unique=True)
    songs.create_index("yt_video_id", unique=True, sparse=True)
    likes.create_index([("user_id", ASCENDING), ("song_id", ASCENDING)], unique=True)
    playlists.create_index("id", unique=True)
    db.listening_sessions.create_index("id", unique=True)
    db.listening_sessions.create_index([("user_id", ASCENDING), ("started_at", DESCENDING)])
    db.interaction_events.create_index("id", unique=True)
    db.interaction_events.create_index([("user_id", ASCENDING), ("timestamp", DESCENDING)])
    db.user_song_stats.create_index([("user_id", ASCENDING), ("song_id", ASCENDING)], unique=True)
    db.user_artist_stats.create_index([("user_id", ASCENDING), ("artist", ASCENDING)], unique=True)
    db.user_album_stats.create_index([("user_id", ASCENDING), ("album", ASCENDING), ("artist", ASCENDING)], unique=True)
    recent_plays.create_index([("user_id", ASCENDING), ("session_id", ASCENDING)], unique=True)
    search_history.create_index("id", unique=True)
    search_history.create_index([("user_id", ASCENDING), ("timestamp", DESCENDING)])
    db.playlist_analytics.create_index([("user_id", ASCENDING), ("playlist_id", ASCENDING), ("song_id", ASCENDING)], unique=True)
    if not users.find_one({"email": "demo@test.com"}):
        users.insert_one({"id": str(uuid.uuid4()), "email": "demo@test.com", "name": "Demo",
                          "password_hash": password_hash("demo1234"), "created_at": utcnow()})


@app.get("/")
def root(): return {"status": "running", "database": DB_NAME}


@app.get("/health")
def health():
    client.admin.command("ping")
    return {"status": "healthy"}


@app.post("/auth/register", status_code=201)
def register(body: RegisterBody):
    user = {"id": str(uuid.uuid4()), "email": body.email.lower().strip(),
            "name": body.name.strip() if body.name and body.name.strip() else None,
            "password_hash": password_hash(body.password), "created_at": utcnow()}
    try: users.insert_one(user)
    except DuplicateKeyError: raise HTTPException(409, "An account with this email already exists")
    return {"access_token": token_for(user["id"]), "token_type": "bearer", "user": user_json(user)}


@app.post("/auth/login")
def login(body: LoginBody):
    user = users.find_one({"email": body.email.lower().strip()}, {"_id": 0})
    if not user or not password_ok(body.password, user.get("password_hash", "")):
        raise HTTPException(401, "Invalid email or password")
    return {"access_token": token_for(user["id"]), "token_type": "bearer", "user": user_json(user)}


@app.get("/auth/me")
def me(user: Annotated[dict, Depends(current_user)]): return user_json(user)


def clean_title(raw):
    title = re.sub(r"\s*[\(\[](official(?: video| audio)?|lyrics?|lyric video|audio|video|visualizer|mv|hd).*?[\)\]]", "", raw or "Unknown", flags=re.I)
    title = re.sub(r"\s+", " ", title).strip()
    if " - " in title:
        artist, title = title.split(" - ", 1)
        return title.strip(), artist.strip()
    return title, None


BAD_KEYWORDS = {
    "movie",
    "film",
    "trailer",
    "teaser",
    "episode",
    "season",
    "podcast",
    "reaction",
    "review",
    "explained",
    "interview",
    "speech",
    "news",
    "full movie",
    "dubbed",
    "scene",
    "clip",
    "short film",
    "drama",
    "comedy",
    "thriller movie",
    "action movie"
}

GOOD_KEYWORDS = {
    "official",
    "official video",
    "official audio",
    "music video",
    "lyrics",
    "audio",
    "topic",
    "album",
    "single"
}

def normalize_title(title):
    title = title.lower()

    remove = [
        "(official video)",
        "(official audio)",
        "(lyrics)",
        "(lyric video)",
        "[official video]",
        "[official audio]",
        "(audio)",
        "(video)",
        "(hd)",
        "(4k)"
    ]

    for r in remove:
        title = title.replace(r, "")

    title = re.sub(r"\s+", " ", title)

    return title.strip()

def normalize_artist(name):
    name = name.lower()
    name = name.replace("- topic", "")
    return name.strip()

def score_song(entry, query):
    score = 0

    title = (entry.get("title") or "").lower()
    artist = (
        entry.get("artist")
        or entry.get("channel")
        or ""
    ).lower()

    duration = int(entry.get("duration") or 0)

    ################################################
    # Exact title match
    ################################################

    if query.lower() in title:
        score += 100

    ################################################
    # Duration
    ################################################

    if 120 <= duration <= 480:
        score += 30

    elif 30 <= duration <= 900:
        score += 10

    else:
        score -= 100

    ################################################
    # Official uploads
    ################################################

    if "topic" in artist:
        score += 40

    if "vevo" in artist:
        score += 60

    if "official" in title:
        score += 20

    ################################################
    # Albums
    ################################################

    if entry.get("album"):
        score += 15

    ################################################
    # Good keywords
    ################################################

    for word in GOOD_KEYWORDS:
        if word in title:
            score += 5

    ################################################
    # Bad keywords
    ################################################

    for word in BAD_KEYWORDS:
        if word in title:
            score -= 200

    ################################################
    # Huge videos
    ################################################

    if duration > 1200:
        score -= 500

    return score
def _contains_keyword(text, keywords):
    """Whole-word keyword match to avoid false positives like
    'drama' matching 'dramatic' or 'news' matching 'newsletter'."""
    return any(re.search(rf"\b{re.escape(word)}\b", text) for word in keywords)


def is_valid_song(entry):
    title = (entry.get("title") or "").lower()
    duration = int(entry.get("duration") or 0)

    if duration < 30 or duration > 1200:
        return False

    if _contains_keyword(title, BAD_KEYWORDS):
        return False

    return True


def score_song(entry, query):
    score = 0

    title = (entry.get("title") or "").lower()
    artist = (entry.get("artist") or entry.get("channel") or "").lower()
    duration = int(entry.get("duration") or 0)

    if query.lower() in title:
        score += 100

    if 120 <= duration <= 480:
        score += 30
    elif 30 <= duration <= 900:
        score += 10
    else:
        score -= 100

    if "topic" in artist:
        score += 40
    if "vevo" in artist:
        score += 60
    if "official" in title:
        score += 20

    if entry.get("album"):
        score += 15

    if _contains_keyword(title, GOOD_KEYWORDS):
        score += 5

    if _contains_keyword(title, BAD_KEYWORDS):
        score -= 200

    if duration > 1200:
        score -= 500

    return score


def youtube_search(query, limit):
    opts = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
        "extract_flat": "in_playlist",
        "playlistend": limit * 3,  # over-fetch since we'll filter some out
        "cachedir": False,
    }
    # The YouTube Music search page also returns album/artist cards without a
    # duration. yt-dlp exposes those beside videos, causing every result to be
    # rejected by is_valid_song. ytsearch returns actual playable video entries.
    search_url = f"ytsearch{limit * 3}:{query} song"

    with yt_dlp.YoutubeDL(opts) as ydl:
        entries = ydl.extract_info(search_url, download=False).get("entries", [])

    candidates = []
    for entry in entries:
        video_id = entry.get("id")
        if not video_id:
            continue

        title, parsed_artist = clean_title(entry.get("title"))
        artist = (
            parsed_artist
            or entry.get("artist")
            or entry.get("channel")
            or entry.get("uploader")
            or "Unknown Artist"
        )
        artist = re.sub(r"\s*-\s*Topic\s*$", "", artist, flags=re.I)

        thumbs = [t for t in entry.get("thumbnails", []) if isinstance(t, dict) and t.get("url")]
        artwork = (
            max(thumbs, key=lambda t: (t.get("width") or 0) * (t.get("height") or 0))["url"]
            if thumbs else f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg"
        )

        item = {
            # External results are intentionally temporary. They receive a
            # recognizable client ID and are persisted only when played.
            "id": f"external:{video_id}",
            "yt_video_id": video_id,
            "title": title,
            "artist": artist,
            "album": entry.get("album"),
            "duration": int(entry.get("duration") or 0),
            "artwork": artwork,
        }

        if not is_valid_song(item):
            continue

        item["_score"] = score_song(item, query)
        candidates.append(item)

    # best matches first
    candidates.sort(key=lambda x: x["_score"], reverse=True)
    candidates = candidates[:limit]

    for item in candidates:
        item.pop("_score", None)
    return [song_json(item) for item in candidates]


def _search_rank(song, query):
    """Rank exact and prefix matches above loose substring matches."""
    needle = query.casefold()

    def field_score(value, exact, prefix, contains):
        value = (value or "").strip().casefold()
        if value == needle:
            return exact
        if value.startswith(needle):
            return prefix
        if needle in value:
            return contains
        return 0

    return max(
        field_score(song.get("title"), 500, 400, 300),
        field_score(song.get("artist"), 450, 350, 250),
        field_score(song.get("album"), 425, 325, 225),
    )


def _group_search_results(items, query, limit):
    unique = {}
    for song in items:
        key = song.get("yt_video_id") or song.get("id")
        unique.setdefault(key, song)

    ranked = sorted(
        unique.values(), key=lambda song: _search_rank(song, query), reverse=True
    )[:limit]
    artists = {}
    albums = {}
    for song in ranked:
        artist = (song.get("artist") or "").strip()
        if artist and artist.casefold() != "unknown artist":
            group = artists.setdefault(artist.casefold(), {"name": artist, "artwork": song.get("artwork"), "songs": []})
            group["songs"].append(song_json(song))
        album = (song.get("album") or "").strip()
        if album:
            group = albums.setdefault((album.casefold(), artist.casefold()), {
                "title": album, "artist": artist or "Unknown Artist", "artwork": song.get("artwork"), "songs": [],
            })
            group["songs"].append(song_json(song))

    def relevance(group, field):
        value, needle = group[field].casefold(), query.casefold()
        return (value == needle, value.startswith(needle), needle in value, len(group["songs"]))

    return {
        "songs": [song_json(song) for song in ranked],
        "artists": sorted(artists.values(), key=lambda x: relevance(x, "name"), reverse=True)[:8],
        "albums": sorted(albums.values(), key=lambda x: relevance(x, "title"), reverse=True)[:8],
    }


@app.get("/songs/search")
async def search_songs(q: str = Query(min_length=1, max_length=150), limit: int = Query(20, ge=1, le=25),
                       background_tasks: BackgroundTasks = None,
                       user: Annotated[dict, Depends(current_user)] = None):
    started = time.monotonic()
    query = q.strip()
    if not query:
        raise HTTPException(422, "Search query cannot be empty")
    pattern = re.escape(query)
    local = list(
        songs.find(
            {"$or": [
                {"title": {"$regex": pattern, "$options": "i"}},
                {"artist": {"$regex": pattern, "$options": "i"}},
                {"album": {"$regex": pattern, "$options": "i"}},
            ]},
            {"_id": 0},
        ).limit(limit * 2)
    )
    # YouTube is the discovery catalog and is deliberately queried on every
    # search, regardless of how many local matches exist.
    try:
        external = await asyncio.to_thread(youtube_search, query, limit)
    except Exception:
        log.exception("YouTube search failed")
        if not local:
            raise HTTPException(502, "Music catalog search is temporarily unavailable")
        external = []

    external_ids = [s["yt_video_id"] for s in external if s.get("yt_video_id")]
    # A stored song may have stale text that did not match the local query, so
    # resolve identities for every YouTube result before merging.
    identity_matches = list(songs.find({"yt_video_id": {"$in": external_ids}}, {"_id": 0})) if external_ids else []
    all_local = {s["id"]: s for s in [*local, *identity_matches]}
    stats = {row["song_id"]: row for row in db.user_song_stats.find(
        {"user_id": user["id"], "song_id": {"$in": list(all_local)}}, {"_id": 0, "user_id": 0})}
    local_by_video = {s.get("yt_video_id"): s for s in all_local.values() if s.get("yt_video_id")}
    merged = [{**s, "statistics": stats.get(s["id"])} for s in local]
    for youtube_song in external:
        existing = local_by_video.get(youtube_song.get("yt_video_id"))
        if existing:
            # Latest catalog metadata wins in the response; local identity and
            # analytics remain attached. Search itself performs no writes.
            merged = [s for s in merged if s.get("yt_video_id") != youtube_song.get("yt_video_id")]
            merged.append({**youtube_song, "id": existing["id"], "statistics": stats.get(existing["id"])})
        else:
            merged.append(youtube_song)
    groups = _group_search_results(merged, query, limit)
    search_id = str(uuid.uuid4())
    elapsed_ms = round((time.monotonic() - started) * 1000, 2)
    history = {"id": search_id, "user_id": user["id"], "search_query": query,
        "timestamp": utcnow(), "number_of_results_returned": len(groups["songs"]), "selected_song_id": None,
        "selected_position": None, "search_duration_ms": elapsed_ms}
    background_tasks.add_task(search_history.insert_one, history)
    return {"source": "merged", "results": groups["songs"], **groups,
            "search_id": search_id, "search_duration_ms": elapsed_ms}


@app.post("/songs/materialize")
def materialize_song(body: ExternalSongBody, _: Annotated[dict, Depends(current_user)]):
    """Persist an external catalog result at the moment playback is requested."""
    existing = songs.find_one({"yt_video_id": body.yt_video_id}, {"_id": 0})
    if existing:
        songs.update_one({"id": existing["id"]}, {"$set": {
            "title": body.title.strip(), "artist": body.artist.strip(),
            "album": body.album.strip() if body.album and body.album.strip() else None,
            "duration": body.duration, "artwork": body.artwork, "updated_at": utcnow()}})
        existing = songs.find_one({"id": existing["id"]}, {"_id": 0})
        return song_json(existing)
    song = {
        "id": str(uuid.uuid4()), "yt_video_id": body.yt_video_id,
        "title": body.title.strip(), "artist": body.artist.strip(),
        "album": body.album.strip() if body.album and body.album.strip() else None,
        "duration": body.duration, "artwork": body.artwork, "created_at": utcnow(), "updated_at": utcnow(),
    }
    try:
        songs.insert_one(song)
    except DuplicateKeyError:
        song = songs.find_one({"yt_video_id": body.yt_video_id}, {"_id": 0})
    return song_json(song)


@app.get("/catalog/artist")
def artist_detail(name: str = Query(min_length=1, max_length=150)):
    artist = name.strip()
    tracks = list(songs.find(
        {"artist": {"$regex": f"^{re.escape(artist)}$", "$options": "i"}},
        {"_id": 0},
    ).sort("created_at", DESCENDING))
    return {
        "type": "artist", "name": artist,
        "artwork": tracks[0].get("artwork") if tracks else None,
        "songs": [song_json(song) for song in tracks],
    }


@app.get("/catalog/album")
def album_detail(title: str = Query(min_length=1, max_length=150), artist: str | None = None):
    album = title.strip()
    query = {"album": {"$regex": f"^{re.escape(album)}$", "$options": "i"}}
    if artist and artist.strip():
        query["artist"] = {"$regex": f"^{re.escape(artist.strip())}$", "$options": "i"}
    tracks = list(songs.find(query, {"_id": 0}).sort("created_at", DESCENDING))
    return {
        "type": "album", "name": album,
        "artist": artist.strip() if artist else (tracks[0].get("artist") if tracks else None),
        "artwork": tracks[0].get("artwork") if tracks else None,
        "songs": [song_json(song) for song in tracks],
    }

@app.get("/songs/trending/list")
def trending(_: Annotated[dict, Depends(current_user)]):
    pipeline = [{"$match": {"status": "ended"}},
                {"$group": {"_id": "$song_id", "count": {"$sum": 1}, "last": {"$max": "$ended_at"}}},
                {"$sort": {"count": -1, "last": -1}}, {"$limit": 20}]
    ids = [x["_id"] for x in db.listening_sessions.aggregate(pipeline)]
    found = {s["id"]: s for s in songs.find({"id": {"$in": ids}}, {"_id": 0})}
    result = [song_json(found[x]) for x in ids if x in found]
    return result or [song_json(s) for s in songs.find({}, {"_id": 0}).sort("created_at", DESCENDING).limit(20)]


@app.post("/queue/generate")
def generate_queue(user: Annotated[dict, Depends(current_user)],
                   song_id: str = Query(min_length=1), size: int = Query(25, ge=20, le=30)):
    """Build a new queue only when the client starts an explicit playback session."""
    try:
        queue = build_queue_manager(db).create_queue(song_id, user["id"], size)
    except ValueError:
        raise HTTPException(404, "Song not found")
    return [song_json(song) for song in queue]


@app.get("/songs/{song_id}/stream")
async def stream_song(song_id: str, _: Annotated[dict, Depends(current_user)]):
    video_id = require_song(song_id).get("yt_video_id")
    if not video_id: raise HTTPException(404, "No stream is available for this song")
    def resolve():
        options = {
            "quiet": True,
            "no_warnings": True,
            # iOS AVPlayer reliably supports AAC in an M4A container. A plain
            # `bestaudio` frequently selects WebM/Opus, which may not play.
            "format": "bestaudio[ext=m4a]/bestaudio[acodec^=mp4a]/bestaudio/best",
            "noplaylist": True,
        }
        with yt_dlp.YoutubeDL(options) as ydl:
            info = ydl.extract_info(f"https://www.youtube.com/watch?v={video_id}", download=False)
            return {
                "url": info["url"],
                "headers": {str(k): str(v) for k, v in (info.get("http_headers") or {}).items()},
                "format": info.get("ext"),
            }
    try: return await asyncio.to_thread(resolve)
    except Exception:
        log.exception("Stream resolution failed")
        raise HTTPException(502, "Unable to resolve the audio stream")


@app.get("/library/liked/ids")
def liked_ids(user: Annotated[dict, Depends(current_user)]):
    return [x["song_id"] for x in likes.find({"user_id": user["id"]}, {"_id": 0, "song_id": 1})]


@app.get("/library/liked")
def liked_songs(user: Annotated[dict, Depends(current_user)]):
    rows = list(likes.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", DESCENDING))
    found = {s["id"]: s for s in songs.find({"id": {"$in": [r["song_id"] for r in rows]}}, {"_id": 0})}
    return [song_json(found[r["song_id"]]) for r in rows if r["song_id"] in found]


@app.post("/library/like/{song_id}", status_code=204)
def like(song_id: str, user: Annotated[dict, Depends(current_user)]):
    require_song(song_id)
    likes.update_one({"user_id": user["id"], "song_id": song_id}, {"$setOnInsert": {"created_at": utcnow()}}, upsert=True)


@app.delete("/library/like/{song_id}", status_code=204)
def unlike(song_id: str, user: Annotated[dict, Depends(current_user)]):
    likes.delete_one({"user_id": user["id"], "song_id": song_id})


@app.post("/library/play/{song_id}", status_code=204)
def record_play(song_id: str, user: Annotated[dict, Depends(current_user)]):
    require_song(song_id)
    plays.insert_one({"user_id": user["id"], "song_id": song_id, "played_at": utcnow()})


@app.get("/library/recent")
def recent(user: Annotated[dict, Depends(current_user)]):
    ids = []
    for row in recent_plays.find({"user_id": user["id"]}, {"_id": 0}).sort("played_at", DESCENDING).limit(100):
        if row["song_id"] not in ids: ids.append(row["song_id"])
        if len(ids) == 20: break
    if not ids:  # Preserve history created by versions before session analytics.
        for row in plays.find({"user_id": user["id"]}, {"_id": 0}).sort("played_at", DESCENDING).limit(100):
            if row["song_id"] not in ids: ids.append(row["song_id"])
            if len(ids) == 20: break
    found = {s["id"]: s for s in songs.find({"id": {"$in": ids}}, {"_id": 0})}
    return [song_json(found[x]) for x in ids if x in found]


@app.get("/playlists")
def list_playlists(user: Annotated[dict, Depends(current_user)]):
    return [{"id": p["id"], "name": p["name"], "cover": p.get("cover"), "song_count": len(p.get("song_ids", []))}
            for p in playlists.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", DESCENDING)]


@app.post("/playlists", status_code=201)
def create_playlist(body: PlaylistBody, user: Annotated[dict, Depends(current_user)]):
    item = {"id": str(uuid.uuid4()), "user_id": user["id"], "name": body.name.strip(), "description": None,
            "cover": None, "song_ids": [], "created_at": utcnow()}
    playlists.insert_one(item)
    db.playlist_analytics.insert_one({"user_id": user["id"], "playlist_id": item["id"], "song_id": None,
        "playlist_add_count": 0, "playlist_remove_count": 0, "playlist_created_from": body.created_from,
        "created_at": utcnow(), "updated_at": utcnow()})
    return {"id": item["id"], "name": item["name"], "cover": None, "song_count": 0}


@app.get("/playlists/{playlist_id}")
def get_playlist(playlist_id: str, user: Annotated[dict, Depends(current_user)]):
    item = playlists.find_one({"id": playlist_id, "user_id": user["id"]}, {"_id": 0})
    if not item: raise HTTPException(404, "Playlist not found")
    ids = item.get("song_ids", [])
    found = {s["id"]: s for s in songs.find({"id": {"$in": ids}}, {"_id": 0})}
    return {"id": item["id"], "name": item["name"], "description": item.get("description"),
            "cover": item.get("cover"), "tracks": [song_json(found[x]) for x in ids if x in found]}


@app.post("/playlists/{playlist_id}/songs", status_code=204)
def add_playlist_song(playlist_id: str, body: PlaylistSongBody,
                      background_tasks: BackgroundTasks,
                      user: Annotated[dict, Depends(current_user)]):
    require_song(body.song_id)
    result = playlists.update_one(
        {"id": playlist_id, "user_id": user["id"]},
        {"$addToSet": {"song_ids": body.song_id}, "$set": {"updated_at": utcnow()}},
    )
    if not result.matched_count:
        raise HTTPException(404, "Playlist not found")
    if result.modified_count:
        background_tasks.add_task(db.playlist_analytics.update_one,
            {"user_id": user["id"], "playlist_id": playlist_id, "song_id": body.song_id},
            {"$inc": {"playlist_add_count": 1}, "$set": {"updated_at": utcnow()},
             "$setOnInsert": {"playlist_remove_count": 0, "playlist_created_from": "existing_playlist"}}, True)
        background_tasks.add_task(db.interaction_events.insert_one, {
            "id": str(uuid.uuid4()), "user_id": user["id"], "song_id": body.song_id,
            "session_id": None, "event_type": "add_to_playlist", "timestamp": utcnow(),
            "playback_position": 0, "metadata": {"playlist_id": playlist_id}})


@app.delete("/playlists/{playlist_id}/songs/{song_id}", status_code=204)
def remove_playlist_song(playlist_id: str, song_id: str, background_tasks: BackgroundTasks,
                         user: Annotated[dict, Depends(current_user)]):
    result = playlists.update_one(
        {"id": playlist_id, "user_id": user["id"], "song_ids": song_id},
        {"$pull": {"song_ids": song_id}, "$set": {"updated_at": utcnow()}},
    )
    if not result.matched_count:
        raise HTTPException(404, "Playlist or song not found")
    background_tasks.add_task(db.playlist_analytics.update_one,
        {"user_id": user["id"], "playlist_id": playlist_id, "song_id": song_id},
        {"$inc": {"playlist_remove_count": 1}, "$set": {"updated_at": utcnow()},
         "$setOnInsert": {"playlist_add_count": 0, "playlist_created_from": "existing_playlist"}}, True)
    background_tasks.add_task(db.interaction_events.insert_one, {
        "id": str(uuid.uuid4()), "user_id": user["id"], "song_id": song_id,
        "session_id": None, "event_type": "remove_from_playlist", "timestamp": utcnow(),
        "playback_position": 0, "metadata": {"playlist_id": playlist_id}})


@app.get("/profile/stats")
def stats(user: Annotated[dict, Depends(current_user)]):
    return {"liked": likes.count_documents({"user_id": user["id"]}),
            "playlists": playlists.count_documents({"user_id": user["id"]}),
            "plays": db.listening_sessions.count_documents({"user_id": user["id"], "status": "ended"}) or
                     plays.count_documents({"user_id": user["id"]})}
