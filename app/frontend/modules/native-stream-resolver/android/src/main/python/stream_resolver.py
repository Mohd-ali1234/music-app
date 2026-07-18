import json
import re
from yt_dlp import YoutubeDL

_VIDEO_ID = re.compile(r"^[A-Za-z0-9_-]{11}$")

def resolve_stream(video_id: str) -> str:
    if not _VIDEO_ID.fullmatch(video_id or ""):
        raise ValueError("invalid_video_id")
    options = {"quiet": True, "no_warnings": True, "noplaylist": True, "socket_timeout": 12,
               "format": "bestaudio[ext=m4a]/bestaudio[acodec^=mp4a]/bestaudio/best"}
    with YoutubeDL(options) as ydl:
        info = ydl.extract_info(f"https://www.youtube.com/watch?v={video_id}", download=False)
    url = (info or {}).get("url")
    if not url:
        raise RuntimeError("yt-dlp did not return a playable stream URL")
    return json.dumps({"streamUrl": url, "headers": (info or {}).get("http_headers") or {}})
