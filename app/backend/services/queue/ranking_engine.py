from .models import Candidate


DEFAULT_WEIGHTS = {
    "same_artist": 100, "same_album": 70, "favorite": 90, "repeat": 40,
    "completion": 30, "recent": 20, "search_match": 20, "time_match": 10,
    "discovery": 10, "skip_rate": -80,
}


class RankingEngine:
    def __init__(self, providers, weights=None, discovery_ratio=.1):
        self.providers = providers
        self.weights = {**DEFAULT_WEIGHTS, **(weights or {})}
        self.discovery_ratio = discovery_ratio

    def rank(self, seed, user_id, size=25):
        merged = {}
        for provider in self.providers:
            for candidate in provider.candidates(seed, user_id):
                item = merged.setdefault(candidate.song["id"], Candidate(candidate.song, {}))
                for signal, value in candidate.signals.items():
                    item.signals[signal] = max(item.signals.get(signal, 0), value)
        scored = [(sum(self.weights.get(k, 0) * v for k, v in c.signals.items()), c) for c in merged.values()]
        scored.sort(key=lambda item: (-item[0], item[1].song["id"]))
        discovery_count = min(max(1, round((size - 1) * self.discovery_ratio)), max(0, size - 1))
        discovery = [x for x in scored if x[1].signals.get("discovery") and not any(
            x[1].signals.get(s) for s in self.weights if s != "discovery")][:discovery_count]
        discovery_ids = {x[1].song["id"] for x in discovery}
        primary = [x for x in scored if x[1].song["id"] not in discovery_ids]
        selected = self._diversify(primary, max(0, size - 1 - len(discovery)))
        # Space discovery tracks through the result instead of appending a block.
        for i, item in enumerate(discovery, 1):
            selected.insert(min(len(selected), round(i * len(selected) / (len(discovery) + 1))), item)
        return [seed] + [candidate.song for _, candidate in selected[:size - 1]]

    @staticmethod
    def _diversify(scored, count):
        result, remaining = [], list(scored)
        while remaining and len(result) < count:
            recent_artists = [x[1].song.get("artist", "").casefold() for x in result[-2:]]
            choice = next((x for x in remaining if x[1].song.get("artist", "").casefold() not in recent_artists), remaining[0])
            result.append(choice)
            remaining.remove(choice)
        return result
