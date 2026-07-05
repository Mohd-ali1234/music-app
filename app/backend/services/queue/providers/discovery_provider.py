from ..models import Candidate
from .base import CandidateProvider


class DiscoveryProvider(CandidateProvider):
    def __init__(self, db): self.songs = db.songs

    def candidates(self, seed, user_id):
        pipeline = [{"$match": {"id": {"$ne": seed["id"]}}}, {"$sample": {"size": 50}}, {"$project": {"_id": 0}}]
        return [Candidate(song, {"discovery": 1}) for song in self.songs.aggregate(pipeline)]
