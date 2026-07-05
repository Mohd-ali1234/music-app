class QueueManager:
    """Creates a playback session queue; ranking policy is injected."""
    def __init__(self, songs, ranking_engine):
        self.songs = songs
        self.ranking_engine = ranking_engine

    def create_queue(self, seed_song_id, user_id, size=25):
        seed = self.songs.find_one({"id": seed_song_id}, {"_id": 0})
        if not seed: raise ValueError("Song not found")
        return self.ranking_engine.rank(seed, user_id, max(20, min(30, size)))
