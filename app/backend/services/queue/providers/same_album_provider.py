import re
from ..models import Candidate
from .base import CandidateProvider


class SameAlbumProvider(CandidateProvider):
    def __init__(self, db): self.songs = db.songs

    def candidates(self, seed, user_id):
        album = seed.get("album")
        if not album: return []
        rows = self.songs.find({"album": {"$regex": f"^{re.escape(album)}$", "$options": "i"},
                                "id": {"$ne": seed["id"]}}, {"_id": 0}).limit(100)
        return [Candidate(song, {"same_album": 1}) for song in rows]
