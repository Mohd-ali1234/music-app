from dataclasses import dataclass, field


@dataclass
class Candidate:
    song: dict
    signals: dict[str, float] = field(default_factory=dict)

