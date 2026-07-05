from collections import Counter
from ..models import Candidate
from .base import CandidateProvider


class SearchHistoryProvider(CandidateProvider):
    def __init__(self, db): self.db = db

    def candidates(self, seed, user_id):
        searches = self.db.search_history.find({"user_id": user_id}, {"search_query": 1}).sort("timestamp", -1).limit(100)
        terms = Counter(str(x.get("search_query", "")).strip().casefold() for x in searches if x.get("search_query"))
        if not terms: return []
        result, peak = [], max(terms.values())
        for song in self.db.songs.find({}, {"_id": 0}).limit(500):
            if song["id"] == seed["id"]: continue
            text = " ".join(str(song.get(k) or "") for k in ("title", "artist", "album")).casefold()
            strength = sum(count for term, count in terms.items() if term in text)
            if strength: result.append(Candidate(song, {"search_match": min(1, strength / peak)}))
        return result
