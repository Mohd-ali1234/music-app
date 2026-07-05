from abc import ABC, abstractmethod


class CandidateProvider(ABC):
    @abstractmethod
    def candidates(self, seed: dict, user_id: str) -> list:
        raise NotImplementedError

