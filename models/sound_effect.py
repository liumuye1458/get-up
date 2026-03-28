from __future__ import annotations

from dataclasses import asdict, dataclass, field
from pathlib import Path
from uuid import uuid4

from config import PRESET_COLORS, VOLUME_DEFAULT_SOUND


@dataclass(slots=True)
class SoundEffect:
    id: str
    name: str
    original_filename: str
    library_path: str
    tags: list[str] = field(default_factory=list)
    hotkey: str = ""
    color: str = PRESET_COLORS[0]
    enabled: bool = True
    loop: bool = False
    sort_order: int = 0
    volume: int = VOLUME_DEFAULT_SOUND
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
        color: str,
        sort_order: int,
    ) -> "SoundEffect":
        return cls(
            id=str(uuid4()),
            name=name[:50],
            original_filename=original_filename,
            library_path=library_path,
            color=color,
            sort_order=sort_order,
        )

    @classmethod
    def from_dict(cls, payload: dict[str, object]) -> "SoundEffect":
        return cls(
            id=str(payload.get("id") or uuid4()),
            name=str(payload.get("name") or ""),
            original_filename=str(payload.get("original_filename") or ""),
            library_path=str(payload.get("library_path") or ""),
            tags=list(payload.get("tags") or []),
            hotkey=str(payload.get("hotkey") or ""),
            color=str(payload.get("color") or PRESET_COLORS[0]),
            enabled=bool(payload.get("enabled", True)),
            loop=bool(payload.get("loop", False)),
            sort_order=int(payload.get("sort_order", 0)),
            volume=int(payload.get("volume", VOLUME_DEFAULT_SOUND)),
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

    @property
    def filename_stem(self) -> str:
        return Path(self.original_filename).stem
