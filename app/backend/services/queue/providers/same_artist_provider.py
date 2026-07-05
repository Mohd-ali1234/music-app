from ..models import Candidate
from .base import CandidateProvider


class SameArtistProvider(CandidateProvider):
    def __init__(self, db): self.songs = db.songs

    def candidates(self, seed, user_id):
        artist = seed.get("artist")
        if not artist: return []
        rows = self.songs.find({"artist": {"$regex": f"^{__import__('re').escape(artist)}$", "$options": "i"},
                                "id": {"$ne": seed["id"]}}, {"_id": 0}).limit(100)
        return [Candidate(song, {"same_artist": 1}) for song in rows]
