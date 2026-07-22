"""YouTube / YouTube Music integration.

A thin, cached wrapper around ``ytmusicapi`` (metadata search) and ``yt-dlp``
(stream URL resolution). Both libraries are synchronous/blocking, so every
call here blocks; route handlers are plain ``def`` functions and therefore run
in FastAPI's threadpool.

In-process ``TTLCache`` layers absorb repeated searches and stream lookups so
identical requests within the TTL window cost zero outbound calls.
"""
from __future__ import annotations

import logging
import os
import threading

from cachetools import TTLCache
from yt_dlp import YoutubeDL
from ytmusicapi import YTMusic

from app.core.config import get_settings

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
    """Cached YouTube Music / yt-dlp client. Injectable so tests can fake it."""

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
        except Exception as exc:  # noqa: BLE001
            log.warning("YouTube Music search failed for %r: %s", query, exc)
            entries = []
        songs: list[dict] = []
        seen: set[str] = set()
        for entry in entries:
            song = _ytmusic_to_song(entry)
            if not song or song["yt_video_id"] in seen:
                continue
            seen.add(song["yt_video_id"])
            songs.append(song)
        with _SEARCH_LOCK:
            _SEARCH_CACHE[key] = songs
        return songs

    def resolve_stream(self, yt_video_id: str) -> tuple[str, dict[str, str]] | None:
        with _STREAM_LOCK:
            hit = _STREAM_CACHE.get(yt_video_id)
            if hit:
                return hit
        settings = get_settings()
        opts = {
            **_YDL_BASE_OPTS,
            "extract_flat": False,
            # AVFoundation on iOS does not support YouTube's WebM/Opus audio
            # streams. Prefer the M4A/AAC variant before falling back.
            "format": "bestaudio[ext=m4a]/bestaudio[acodec^=mp4a]/bestaudio/best",
            # The "web" client now frequently demands a PO token / sign-in
            # challenge from datacenter IPs ("Sign in to confirm you're not a
            # bot"). The android/ios clients don't require that handshake, so
            # try them first and only fall back to web.
            "extractor_args": {"youtube": {"player_client": ["android", "ios", "web"]}},
        }
        if settings.ytdlp_pot_provider_url:
            # bgutil-ytdlp-pot-provider (installed as a yt-dlp plugin) fetches
            # a fresh proof-of-origin token from this server per request,
            # which satisfies the bot-check without any account cookies.
            opts["extractor_args"]["youtubepot-bgutilhttp"] = {
                "base_url": settings.ytdlp_pot_provider_url
            }
        if settings.ytdlp_cookies_file and os.path.isfile(settings.ytdlp_cookies_file):
            opts["cookiefile"] = settings.ytdlp_cookies_file
        log.info(
            "resolve_stream(%s): pot_provider_url=%r cookies_file=%r (exists=%s)",
            yt_video_id,
            settings.ytdlp_pot_provider_url or None,
            settings.ytdlp_cookies_file or None,
            bool(settings.ytdlp_cookies_file and os.path.isfile(settings.ytdlp_cookies_file)),
        )
        try:
            with YoutubeDL(opts) as ydl:
                info = ydl.extract_info(
                    f"https://www.youtube.com/watch?v={yt_video_id}", download=False
                )
        except Exception as exc:  # noqa: BLE001
            log.warning("yt-dlp stream resolve failed for %s: %s", yt_video_id, exc)
            return None
        if not info:
            return None
        url = info.get("url")
        if not url:
            for fmt in reversed(info.get("formats") or []):
                if fmt.get("acodec") and fmt["acodec"] != "none" and fmt.get("url"):
                    url = fmt["url"]
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


_default_client: YouTubeClient | None = None


def get_youtube_client() -> YouTubeClient:
    """Return the process-wide :class:`YouTubeClient` singleton."""
    global _default_client
    if _default_client is None:
        _default_client = YouTubeClient()
    return _default_client
