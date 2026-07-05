from datetime import datetime, timezone
from ..models import Candidate
from .base import CandidateProvider


class RecentProvider(CandidateProvider):
    def __init__(self, db): self.db = db

    def candidates(self, seed, user_id):
        rows = list(self.db.recently_played.find({"user_id": user_id}, {"_id": 0})
                    .sort("played_at", -1).limit(100))
        found = {s["id"]: s for s in self.db.songs.find(
            {"id": {"$in": [r["song_id"] for r in rows]}}, {"_id": 0})}
        now = datetime.now(timezone.utc)
        result = []
        for row in rows:
            song = found.get(row["song_id"])
            if not song or song["id"] == seed["id"]: continue
            played = row.get("played_at")
            if played and played.tzinfo is None: played = played.replace(tzinfo=timezone.utc)
            days = max(0, (now - played).days) if played else 30
            result.append(Candidate(song, {"recent": 1 / (1 + days / 7)}))
        return result
