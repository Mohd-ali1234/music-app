import difflib
import json
import logging
import queue
import threading
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone

log = logging.getLogger(__name__)


def _now():
    return datetime.now(timezone.utc)


def _norm(value):
    return " ".join((value or "").casefold().split())


class MusicBrainzEnricher:
    """Single-worker MusicBrainz client: playback never waits for this service."""

    def __init__(self, songs, cache, user_agent):
        self.songs = songs
        self.cache = cache
        self.user_agent = user_agent
        self.jobs = queue.Queue()
        self.pending = set()
        self.lock = threading.Lock()
        self.last_request = 0.0
        threading.Thread(target=self._work, daemon=True, name="musicbrainz-enrichment").start()

    def enqueue(self, song_id):
        song = self.songs.find_one({"id": song_id}, {"metadata.enrichment_status": 1})
        if not song or song.get("metadata", {}).get("enrichment_status") == "succeeded":
            return
        with self.lock:
            if song_id in self.pending:
                return
            self.pending.add(song_id)
        self.songs.update_one({"id": song_id}, {"$set": {"metadata.enrichment_status": "queued"}})
        self.jobs.put(song_id)

    def _request(self, path, params):
        delay = 1.05 - (time.monotonic() - self.last_request)
        if delay > 0:
            time.sleep(delay)
        url = "https://musicbrainz.org/ws/2/" + path + "?" + urllib.parse.urlencode({**params, "fmt": "json"})
        request = urllib.request.Request(url, headers={"User-Agent": self.user_agent, "Accept": "application/json"})
        for attempt in range(3):
            try:
                with urllib.request.urlopen(request, timeout=12) as response:
                    self.last_request = time.monotonic()
                    return json.load(response)
            except Exception:
                self.last_request = time.monotonic()
                if attempt == 2:
                    raise
                time.sleep(2 ** attempt)

    def _work(self):
        while True:
            song_id = self.jobs.get()
            try:
                self._enrich(song_id)
            except Exception as exc:
                log.exception("MusicBrainz enrichment failed for %s", song_id)
                self.songs.update_one({"id": song_id}, {"$set": {
                    "metadata.enrichment_status": "failed", "metadata.last_error": str(exc)[:500],
                    "metadata.fetched_at": _now(), "updated_at": _now(),
                }, "$inc": {"metadata.enrichment_attempts": 1}})
            finally:
                with self.lock:
                    self.pending.discard(song_id)
                self.jobs.task_done()

    def _enrich(self, song_id):
        song = self.songs.find_one({"id": song_id}, {"_id": 0})
        if not song:
            return
        key = f"{_norm(song.get('title'))}|{_norm(song.get('artist'))}"
        cached = self.cache.find_one({"key": key}, {"_id": 0})
        if cached and cached.get("result") is not None:
            result = cached["result"]
        else:
            query = f'recording:"{song.get("title", "")}" AND artist:"{song.get("artist", "")}"'
            payload = self._request("recording", {"query": query, "limit": 10})
            candidates = payload.get("recordings", [])
            result = self._best(song, candidates)
            self.cache.update_one({"key": key}, {"$set": {"result": result, "fetched_at": _now()}}, upsert=True)

        now = _now()
        if not result:
            self.songs.update_one({"id": song_id}, {"$set": {
                "metadata.enrichment_status": "no_match", "metadata.fetched_at": now, "updated_at": now,
            }, "$inc": {"metadata.enrichment_attempts": 1}})
            return
        non_null = {f"musicbrainz.{k}": v for k, v in result.items() if v not in (None, "", [])}
        non_null.update({"metadata.enrichment_status": "succeeded", "metadata.fetched_at": now, "metadata.last_error": None, "updated_at": now})
        self.songs.update_one({"id": song_id}, {"$set": non_null, "$inc": {"metadata.enrichment_attempts": 1}})

    def _best(self, song, candidates):
        def similarity(a, b):
            return difflib.SequenceMatcher(None, _norm(a), _norm(b)).ratio()

        def score(recording):
            artists = ", ".join(x.get("name", "") for x in recording.get("artist-credit", []) if isinstance(x, dict))
            value = similarity(song.get("title"), recording.get("title")) * 0.55
            value += similarity(song.get("artist"), artists) * 0.35
            expected, actual = int(song.get("duration") or 0), int((recording.get("length") or 0) / 1000)
            if expected and actual:
                value += max(0, 1 - abs(expected - actual) / max(expected, 1)) * 0.10
            return value

        if not candidates:
            return None
        recording = max(candidates, key=score)
        if score(recording) < 0.62:
            return None
        confidence = score(recording)
        recording = self._request(f"recording/{recording['id']}", {
            "inc": "artists+releases+release-groups+isrcs+tags+genres"
        })
        credits = [x for x in recording.get("artist-credit", []) if isinstance(x, dict)]
        artist = credits[0].get("artist", {}) if credits else {}
        releases = recording.get("releases") or []
        release = releases[0] if releases else {}
        release_details = {}
        if release.get("id"):
            try:
                release_details = self._request(f"release/{release['id']}", {
                    "inc": "labels+recordings+artist-credits+release-groups"
                })
            except Exception:
                log.warning("Could not load MusicBrainz release details for %s", release.get("id"))
        release = {**release, **release_details}
        date = release.get("date")
        tags = sorted({x.get("name") for x in recording.get("tags", []) if x.get("name")})
        genres = sorted({x.get("name") for x in recording.get("genres", []) if x.get("name")})
        secondary = release.get("release-group", {}).get("secondary-types", [])
        track_number = disc_number = None
        for medium in release.get("media", []):
            for track in medium.get("tracks", []):
                if track.get("recording", {}).get("id") == recording.get("id"):
                    track_number, disc_number = track.get("number") or track.get("position"), medium.get("position")
                    break
        labels = [x.get("label", {}).get("name") for x in release.get("label-info", []) if x.get("label")]
        return {
            "recording_id": recording.get("id"), "release_id": release.get("id"),
            "artist_id": artist.get("id"), "artist_name": artist.get("name"),
            "album": release.get("title"), "album_artist": release.get("artist-credit-phrase"),
            "release_date": date, "release_year": int(date[:4]) if date and date[:4].isdigit() else None,
            "country": release.get("country"), "language": release.get("text-representation", {}).get("language"),
            "primary_type": release.get("release-group", {}).get("primary-type"), "secondary_types": secondary,
            "genres": genres, "tags": tags, "label": labels[0] if labels else None,
            "track_number": track_number, "disc_number": disc_number, "recording_length": (recording.get("length") or 0) / 1000 or None,
            "isrc": (recording.get("isrcs") or [None])[0], "confidence": round(confidence, 4),
            "extra": {"disambiguation": recording.get("disambiguation")},
        }
