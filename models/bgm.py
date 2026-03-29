from __future__ import annotations

from dataclasses import asdict, dataclass
from uuid import uuid4

from config import PRESET_COLORS, VOLUME_DEFAULT_BGM


@dataclass(slots=True)
class BackgroundMusic:
    id: str
    name: str
    original_filename: str
    library_path: str
    color: str = PRESET_COLORS[0]
    hotkey: str = ""
    enabled: bool = True
    loop: bool = True
    sort_order: int = 0
    volume: int = VOLUME_DEFAULT_BGM
    speed: float = 1.0
    fade_in: bool = False
    fade_in_duration: float = 0.5
    trim_start: float = 0.0
    trim_end: float | None = None

    @classmethod
    def create(
        cls,
        name: str,
        original_filename: str,
        library_path: str,
        *,
        sort_order: int,
    ) -> "BackgroundMusic":
        return cls(
            id=str(uuid4()),
            name=name[:50],
            original_filename=original_filename,
            library_path=library_path,
            color=PRESET_COLORS[0],
            sort_order=sort_order,
        )

    @classmethod
    def from_dict(cls, payload: dict[str, object]) -> "BackgroundMusic":
        return cls(
            id=str(payload.get("id") or uuid4()),
            name=str(payload.get("name") or ""),
            original_filename=str(payload.get("original_filename") or ""),
            library_path=str(payload.get("library_path") or ""),
            color=str(payload.get("color") or PRESET_COLORS[0]),
            hotkey=str(payload.get("hotkey") or ""),
            enabled=bool(payload.get("enabled", True)),
            loop=bool(payload.get("loop", True)),
            sort_order=int(payload.get("sort_order", 0)),
            volume=int(payload.get("volume", VOLUME_DEFAULT_BGM)),
            speed=float(payload.get("speed", 1.0)),
            fade_in=bool(payload.get("fade_in", False)),
            fade_in_duration=float(payload.get("fade_in_duration", 0.5)),
            trim_start=float(payload.get("trim_start", 0.0)),
            trim_end=(
                float(payload["trim_end"])
                if payload.get("trim_end") is not None
                else None
            ),
        )

    def to_dict(self) -> dict[str, object]:
        return asdict(self)
