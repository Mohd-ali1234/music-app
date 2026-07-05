from datetime import datetime, timezone
from ..models import Candidate
from .base import CandidateProvider


class TimeProvider(CandidateProvider):
    def __init__(self, db): self.db = db

    def candidates(self, seed, user_id):
        hour = datetime.now(timezone.utc).hour
        hours = [(hour + offset) % 24 for offset in range(-2, 3)]
        sessions = list(self.db.listening_sessions.find(
            {"user_id": user_id, "hour_of_day": {"$in": hours}, "status": "ended"}, {"song_id": 1}).limit(100))
        counts = {}
        for row in sessions: counts[row["song_id"]] = counts.get(row["song_id"], 0) + 1
        if not counts: return []
        found = {s["id"]: s for s in self.db.songs.find({"id": {"$in": list(counts)}}, {"_id": 0})}
        peak = max(counts.values())
        return [Candidate(found[sid], {"time_match": count / peak}) for sid, count in counts.items()
                if sid in found and sid != seed["id"]]
