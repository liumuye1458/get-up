from __future__ import annotations

from dataclasses import asdict, dataclass
from uuid import uuid4


@dataclass(slots=True)
class Tag:
    id: str
    name: str
    sort_order: int = 0

    @classmethod
    def create(cls, name: str, sort_order: int) -> "Tag":
        return cls(id=str(uuid4()), name=name[:20], sort_order=sort_order)

    @classmethod
    def from_dict(cls, payload: dict[str, object]) -> "Tag":
        return cls(
            id=str(payload.get("id") or uuid4()),
            name=str(payload.get("name") or ""),
            sort_order=int(payload.get("sort_order", 0)),
        )

    def to_dict(self) -> dict[str, object]:
        return asdict(self)
