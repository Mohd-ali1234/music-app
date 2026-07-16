
# Action: file_editor create /app/backend/youtube_client.py --file-text """"yt-dlp wrapper with in-process TTL cache for search + stream URL resolution.

# All calls are blocking (yt-dlp is sync). Route handlers are plain ``def`` so
# FastAPI runs them in a threadpool.
# """
from __future__ import annotations

import logging
import threading
from typing import Any

from cachetools import TTLCache
from yt_dlp import YoutubeDL
from ytmusicapi import YTMusic

log = logging.getLogger(__name__)

_SEARCH_CACHE: TTLCache[str, list[dict]] = TTLCache(maxsize=512, ttl=600)
_STREAM_CACHE: TTLCache[str, tuple[str, dict[str, str]]] = TTLCache(maxsize=1024, ttl=300)
_SEARCH_LOCK = threading.Lock()
_STREAM_LOCK = threading.Lock()
_ytmusic: YTMusic | None = None

_YDL_BASE_OPTS = {
    "quiet": True,
    "no_warnings": True,
    "extract_flat": "in_playlist",
    "skip_download": True,
    "ignoreerrors": True,
    "socket_timeout": 8,
    "noplaylist": True,
}


def _flat_to_song(entry: dict) -> dict | None:
    """Normalize yt-dlp flat entry into a partial song dict (external)."""
    if not entry:
        return None
    vid = entry.get("id") or entry.get("url")
    if not vid or len(vid) != 11:
        return None
    title = (entry.get("title") or "").strip()
    # yt-dlp often shoves "Artist - Title" into title for music results
    artist = (entry.get("uploader") or entry.get("channel") or "").strip()
    if " - " in title and (not artist or artist.lower().endswith("- topic")):
        left, right = title.split(" - ", 1)
        artist = artist or left
        title = right.strip() or title
    artist = artist.replace(" - Topic", "").strip()
    duration = entry.get("duration")
    try:
        duration = int(duration) if duration is not None else None
    except (TypeError, ValueError):
        duration = None
    thumbs = entry.get("thumbnails") or []
    artwork = ""
    if thumbs:
        artwork = thumbs[-1].get("url", "")
    elif entry.get("thumbnail"):
        artwork = entry["thumbnail"]
    return {
        "yt_video_id": vid,
        "title": title,
        "artist": artist,
        "album": "",
        "artwork_url": artwork,
        "duration_sec": duration,
        "_external": True,
    }


def _ytmusic_to_song(entry: dict) -> dict | None:
    """Convert a YouTube Music song result into the app's external song shape."""
    video_id = entry.get("videoId")
    title = (entry.get("title") or "").strip()
    artist = ", ".join(
        item.get("name", "").strip()
        for item in (entry.get("artists") or [])
        if item.get("name")
    )
    if not video_id or len(video_id) != 11 or not title or not artist:
        return None
    album = (entry.get("album") or {}).get("name", "")
    thumbnails = entry.get("thumbnails") or []
    artwork = thumbnails[-1].get("url", "") if thumbnails else ""
    # YouTube Music commonly returns a 120px thumbnail in search results.
    # Request a higher-resolution square rendition for grid and player artwork.
    if artwork and "=" in artwork:
        artwork = f"{artwork.rsplit('=', 1)[0]}=w544-h544-l90-rj"
    duration = entry.get("duration_seconds")
    try:
        duration = int(duration) if duration is not None else None
    except (TypeError, ValueError):
        duration = None
    return {
        "yt_video_id": video_id,
        "title": title,
        "artist": artist,
        "album": album,
        "artwork_url": artwork,
        "duration_sec": duration,
        "_external": True,
    }


class YouTubeClient:
    """Thin, cached wrapper around yt-dlp. Injectable for tests."""

    def search(self, query: str, limit: int = 15) -> list[dict]:
        global _ytmusic
        key = f"{query.strip().lower()}|{limit}"
        with _SEARCH_LOCK:
            hit = _SEARCH_CACHE.get(key)
            if hit is not None:
                return hit
        try:
            if _ytmusic is None:
                _ytmusic = YTMusic()
            entries = _ytmusic.search(query, filter="songs", limit=limit)
        except Exception as e:  # noqa: BLE001
            log.warning("YouTube Music search failed for %r: %s", query, e)
            entries = []
        songs: list[dict] = []
        seen: set[str] = set()
        for e in entries:
            s = _ytmusic_to_song(e)
            if not s or s["yt_video_id"] in seen:
                continue
            seen.add(s["yt_video_id"])
            songs.append(s)
        with _SEARCH_LOCK:
            _SEARCH_CACHE[key] = songs
        return songs

    def resolve_stream(self, yt_video_id: str) -> tuple[str, dict[str, str]] | None:
        with _STREAM_LOCK:
            hit = _STREAM_CACHE.get(yt_video_id)
            if hit:
                return hit
        opts = {
            **_YDL_BASE_OPTS,
            "extract_flat": False,
            # AVFoundation on iOS does not support YouTube's WebM/Opus audio
            # streams. Prefer the M4A/AAC variant before falling back.
            "format": "bestaudio[ext=m4a]/bestaudio[acodec^=mp4a]/bestaudio/best",
        }
        try:
            with YoutubeDL(opts) as ydl:
                info = ydl.extract_info(
                    f"https://www.youtube.com/watch?v={yt_video_id}", download=False
                )
        except Exception as e:  # noqa: BLE001
            log.warning("yt-dlp stream resolve failed for %s: %s", yt_video_id, e)
            return None
        if not info:
            return None
        url = info.get("url")
        if not url:
            # walk formats for bestaudio
            for f in reversed(info.get("formats") or []):
                if f.get("acodec") and f["acodec"] != "none" and f.get("url"):
                    url = f["url"]
                    break
        if url:
            headers = {
                str(key): str(value)
                for key, value in (info.get("http_headers") or {}).items()
            }
            with _STREAM_LOCK:
                _STREAM_CACHE[yt_video_id] = (url, headers)
            return url, headers
        return None


# Singleton (swap with fake for tests)
_default_client: YouTubeClient | None = None


def get_youtube_client() -> YouTubeClient:
    global _default_client
    if _default_client is None:
        _default_client = YouTubeClient()
    return _default_client
# "
# Observation: Create successful: /app/backend/youtube_client.py
