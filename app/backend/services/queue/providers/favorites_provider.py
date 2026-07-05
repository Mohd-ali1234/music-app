from ..models import Candidate
from .base import CandidateProvider


class FavoritesProvider(CandidateProvider):
    def __init__(self, db): self.db = db

    def candidates(self, seed, user_id):
        stats = list(self.db.user_song_stats.find({"user_id": user_id}, {"_id": 0})
                     .sort([("play_count", -1), ("completion_percentage", -1)]).limit(100))
        songs = {s["id"]: s for s in self.db.songs.find(
            {"id": {"$in": [x["song_id"] for x in stats]}}, {"_id": 0})}
        result = []
        for stat in stats:
            song = songs.get(stat["song_id"])
            if not song or song["id"] == seed["id"]: continue
            plays = max(float(stat.get("play_count", 0)), 1)
            result.append(Candidate(song, {
                "favorite": min(1, (float(stat.get("play_count", 0)) + float(stat.get("repeat_count", 0)) * 2) / 10),
                "repeat": min(1, float(stat.get("repeat_count", 0)) / 5),
                "completion": min(1, float(stat.get("completion_percentage", 0)) / 100),
                "skip_rate": min(1, float(stat.get("skip_count", 0)) / plays),
            }))
        return result
