
# Action: file_editor create /app/backend/song_utils.py --file-text """"Song normalization, validation, and JSON serialization helpers."""
import re
import unicodedata
from typing import Any

_BLOCKLIST_KEYWORDS = {
    "reaction", "reacts", "review", "cover", "tutorial", "karaoke",
    "instrumental", "lyrics video", "8d audio", "sped up", "slowed",
    "nightcore", "reverb", "mashup", "parody", "guitar lesson",
    "how to play", "interview", "trailer", "commentary",
}

_ARTIST_CLEAN_RE = re.compile(r"s*[-–—]s*topics*$", re.IGNORECASE)
_TITLE_STRIP_RE = re.compile(
    r"s*[([][^)]]*(official|video|audio|lyrics?|hd|4k|mv|m/v|visualizer)[^)]]*[)]]s*",
    re.IGNORECASE,
)


def normalize_title(title: str) -> str:
    if not title:
        return ""
    t = unicodedata.normalize("NFKD", title)
    t = _TITLE_STRIP_RE.sub(" ", t)
    t = re.sub(r"s+", " ", t).strip().lower()
    return t


def normalize_artist(artist: str) -> str:
    if not artist:
        return ""
    a = unicodedata.normalize("NFKD", artist)
    a = _ARTIST_CLEAN_RE.sub("", a)
    a = re.sub(r"s+", " ", a).strip().lower()
    return a


def _whole_word_hit(needle: str, haystack: str) -> bool:
    return re.search(rf"b{re.escape(needle)}b", haystack, re.IGNORECASE) is not None


def is_valid_song(title: str, artist: str, duration_sec: int | None) -> bool:
    """Filter out non-music YouTube results (reactions, tutorials, etc.)."""
    if not title or not artist:
        return False
    if duration_sec is not None and (duration_sec < 45 or duration_sec > 15 * 60):
        return False
    hay = f"{title} {artist}".lower()
    for kw in _BLOCKLIST_KEYWORDS:
        if _whole_word_hit(kw, hay):
            return False
    return True


def song_json(doc: dict[str, Any]) -> dict[str, Any]:
    """Serialize a song dict (local or external) to the wire format."""
    yt_id = doc.get("yt_video_id")
    is_external = bool(doc.get("_external"))
    _id = doc.get("id") or (f"external:{yt_id}" if yt_id else None)
    artwork = doc.get("artwork_url") or ""
    duration = doc.get("duration_sec")
    return {
        "id": _id,
        "yt_video_id": yt_id,
        "title": doc.get("title", ""),
        "artist": doc.get("artist", ""),
        "album": doc.get("album") or "",
        "artwork_url": artwork,
        "artwork": artwork,
        "duration_sec": duration,
        "duration": duration,
        "is_external": is_external or (isinstance(_id, str) and _id.startswith("external:")),
    }


def build_local_song_doc(yt_video_id: str, title: str, artist: str,
                        album: str = "", artwork_url: str = "",
                        duration_sec: int | None = None) -> dict:
    import uuid
    from datetime import datetime, timezone
    return {
        "id": str(uuid.uuid4()),
        "yt_video_id": yt_video_id,
        "title": title,
        "artist": artist,
        "album": album,
        "artwork_url": artwork_url,
        "duration_sec": duration_sec,
        "title_norm": normalize_title(title),
        "artist_norm": normalize_artist(artist),
        "album_norm": normalize_title(album),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": None,
    }
# "
# Observation: Create successful: /app/backend/song_utils.py
