"""Text normalization, matching, and non-music filtering helpers.

Pure functions with no I/O. These define how titles/artists are canonicalized
for storage (``*_norm`` fields) and how obvious non-music YouTube results are
rejected before they ever reach ranking.
"""
from __future__ import annotations

import re
import unicodedata

# Keywords that mark a YouTube result as almost-certainly-not-a-song.
NON_MUSIC_KEYWORDS: frozenset[str] = frozenset({
    "reaction", "reacts", "review", "cover", "tutorial", "karaoke",
    "instrumental", "lyrics video", "8d audio", "sped up", "slowed",
    "nightcore", "reverb", "mashup", "parody", "guitar lesson",
    "how to play", "interview", "trailer", "commentary",
})

# Minimum / maximum plausible duration (seconds) for a real music track.
MIN_SONG_SECONDS = 45
MAX_SONG_SECONDS = 15 * 60

# " - Topic" auto-generated artist channels; parenthetical/bracketed decorations.
_ARTIST_TOPIC_RE = re.compile(r"\s*[-–—]\s*topic\s*$", re.IGNORECASE)
_TITLE_DECORATION_RE = re.compile(
    r"\s*[\(\[][^)\]]*"
    r"(official|video|audio|lyrics?|hd|4k|mv|m/v|visualizer)"
    r"[^)\]]*[\)\]]\s*",
    re.IGNORECASE,
)
_WHITESPACE_RE = re.compile(r"\s+")


def normalize_title(title: str) -> str:
    """Canonicalize a title: strip decorations, collapse whitespace, lowercase."""
    if not title:
        return ""
    text = unicodedata.normalize("NFKD", title)
    text = _TITLE_DECORATION_RE.sub(" ", text)
    text = _WHITESPACE_RE.sub(" ", text).strip().lower()
    return text


def normalize_artist(artist: str) -> str:
    """Canonicalize an artist name: strip ' - Topic', collapse whitespace, lower."""
    if not artist:
        return ""
    text = unicodedata.normalize("NFKD", artist)
    text = _ARTIST_TOPIC_RE.sub("", text)
    text = _WHITESPACE_RE.sub(" ", text).strip().lower()
    return text


def whole_word_hit(needle: str, haystack: str) -> bool:
    """True if ``needle`` occurs as a whole word inside ``haystack``."""
    if not needle:
        return False
    return re.search(rf"\b{re.escape(needle)}\b", haystack, re.IGNORECASE) is not None


def is_valid_song(title: str, artist: str, duration_sec: int | None) -> bool:
    """Reject non-music YouTube results (reactions, tutorials, wrong length)."""
    if not title or not artist:
        return False
    if duration_sec is not None and (
        duration_sec < MIN_SONG_SECONDS or duration_sec > MAX_SONG_SECONDS
    ):
        return False
    haystack = f"{title} {artist}".lower()
    return not any(whole_word_hit(keyword, haystack) for keyword in NON_MUSIC_KEYWORDS)
