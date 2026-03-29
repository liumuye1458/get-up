from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path

from PyQt6.QtCore import QObject, pyqtSignal

from config import BGM_DB_PATH, CONFIG_PATH, DEFAULT_CONFIG, SOUNDS_DB_PATH
from models.bgm import BackgroundMusic
from models.sound_effect import SoundEffect
from models.tag import Tag


class Database(QObject):
    sounds_changed = pyqtSignal()
    bgm_changed = pyqtSignal()
    config_changed = pyqtSignal(dict)
    tag_changed = pyqtSignal()

    def __init__(self) -> None:
        super().__init__()
        self._sounds: list[SoundEffect] = []
        self._tags: list[Tag] = []
        self._bgm: list[BackgroundMusic] = []
        self._config: dict[str, object] = deepcopy(DEFAULT_CONFIG)
        self.load()

    def ensure_storage(self) -> None:
        CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
        if not CONFIG_PATH.exists():
            self._write_json(CONFIG_PATH, self._config)
        if not SOUNDS_DB_PATH.exists():
            self._write_json(SOUNDS_DB_PATH, {"sounds": [], "tags": []})
        if not BGM_DB_PATH.exists():
            self._write_json(BGM_DB_PATH, {"bgm": []})

    def load(self) -> None:
        self.ensure_storage()
        self._config = self._merge_dicts(DEFAULT_CONFIG, self._read_json(CONFIG_PATH, {}))
        hotkeys = dict(self._config.get("hotkeys", {}))
        legacy_stop_all_music = str(hotkeys.get("toggle_hotkey_mode", "") or "")
        if legacy_stop_all_music and not str(hotkeys.get("stop_all_music", "") or ""):
            hotkeys["stop_all_music"] = legacy_stop_all_music
        hotkeys.pop("toggle_hotkey_mode", None)
        self._config["hotkeys"] = hotkeys
        sounds_payload = self._read_json(SOUNDS_DB_PATH, {"sounds": [], "tags": []})
        self._sounds = [
            SoundEffect.from_dict(item) for item in sounds_payload.get("sounds", [])
        ]
        self._sounds.sort(key=lambda sound: sound.sort_order)
        self._tags = [Tag.from_dict(item) for item in sounds_payload.get("tags", [])]
        self._tags.sort(key=lambda tag: tag.sort_order)
        bgm_payload = self._read_json(BGM_DB_PATH, {"bgm": []})
        self._bgm = [BackgroundMusic.from_dict(item) for item in bgm_payload.get("bgm", [])]
        self._bgm.sort(key=lambda bgm: bgm.sort_order)

    def all_sounds(self) -> list[SoundEffect]:
        return list(sorted(self._sounds, key=lambda sound: sound.sort_order))

    def all_tags(self) -> list[Tag]:
        return list(sorted(self._tags, key=lambda tag: tag.sort_order))

    def all_bgms(self) -> list[BackgroundMusic]:
        return list(sorted(self._bgm, key=lambda bgm: bgm.sort_order))

    def config(self) -> dict[str, object]:
        return deepcopy(self._config)

    def count(self) -> int:
        return len(self._sounds)

    def add_sound(self, sound: SoundEffect) -> None:
        self._sounds.append(sound)
        self._normalize_sound_order()
        self.save_sounds()

    def add_sounds(self, sounds: list[SoundEffect]) -> None:
        self._sounds.extend(sounds)
        self._normalize_sound_order()
        self.save_sounds()

    def add_bgm(self, bgm: BackgroundMusic) -> None:
        self._bgm.append(bgm)
        self._normalize_bgm_order()
        self.save_bgms()

    def update_sound(self, updated: SoundEffect) -> None:
        for index, sound in enumerate(self._sounds):
            if sound.id == updated.id:
                self._sounds[index] = updated
                break
        self._normalize_sound_order()
        self.save_sounds()

    def update_bgm(self, updated: BackgroundMusic) -> None:
        for index, bgm in enumerate(self._bgm):
            if bgm.id == updated.id:
                self._bgm[index] = updated
                break
        self._normalize_bgm_order()
        self.save_bgms()

    def delete_sound(self, sound_id: str) -> SoundEffect | None:
        removed = None
        remaining: list[SoundEffect] = []
        for sound in self._sounds:
            if sound.id == sound_id:
                removed = sound
                continue
            remaining.append(sound)
        self._sounds = remaining
        self._normalize_sound_order()
        self.save_sounds()
        return removed

    def delete_bgm(self, bgm_id: str) -> BackgroundMusic | None:
        removed = None
        remaining: list[BackgroundMusic] = []
        for bgm in self._bgm:
            if bgm.id == bgm_id:
                removed = bgm
                continue
            remaining.append(bgm)
        self._bgm = remaining
        self._normalize_bgm_order()
        self.save_bgms()
        return removed

    def duplicate_sound(self, sound_id: str, *, name_suffix: str = " (副本)") -> SoundEffect | None:
        source = self.get_sound(sound_id)
        if source is None:
            return None

        clone = SoundEffect.from_dict(source.to_dict())
        clone.id = SoundEffect.create(
            name=f"{source.name}{name_suffix}",
            original_filename=source.original_filename,
            library_path=source.library_path,
            color=source.color,
            sort_order=max((item.sort_order for item in self._sounds), default=-1) + 1,
        ).id
        clone.name = f"{source.name}{name_suffix}"[:50]
        clone.sort_order = max((item.sort_order for item in self._sounds), default=-1) + 1
        self._sounds.append(clone)
        self._normalize_sound_order()
        self.save_sounds()
        return clone

    def get_sound(self, sound_id: str) -> SoundEffect | None:
        return next((sound for sound in self._sounds if sound.id == sound_id), None)

    def get_bgm(self, bgm_id: str) -> BackgroundMusic | None:
        return next((bgm for bgm in self._bgm if bgm.id == bgm_id), None)

    def duplicate_bgm(self, bgm_id: str, *, name_suffix: str = " (副本)") -> BackgroundMusic | None:
        source = self.get_bgm(bgm_id)
        if source is None:
            return None

        clone = BackgroundMusic.from_dict(source.to_dict())
        clone.id = BackgroundMusic.create(
            name=f"{source.name}{name_suffix}",
            original_filename=source.original_filename,
            library_path=source.library_path,
            sort_order=max((item.sort_order for item in self._bgm), default=-1) + 1,
        ).id
        clone.name = f"{source.name}{name_suffix}"[:50]
        clone.sort_order = max((item.sort_order for item in self._bgm), default=-1) + 1
        self._bgm.append(clone)
        self._normalize_bgm_order()
        self.save_bgms()
        return clone

    def get_tag(self, tag_id: str) -> Tag | None:
        return next((tag for tag in self._tags if tag.id == tag_id), None)

    def add_tag(self, name: str) -> Tag | None:
        normalized = name.strip()
        if not normalized or self._tag_name_exists(normalized):
            return None
        tag = Tag.create(normalized, len(self._tags))
        self._tags.append(tag)
        self._normalize_tag_order()
        self.save_sounds(emit_tag_changed=True)
        return tag

    def rename_tag(self, tag_id: str, name: str) -> bool:
        tag = self.get_tag(tag_id)
        normalized = name.strip()
        if tag is None or not normalized:
            return False
        if self._tag_name_exists(normalized, exclude_id=tag_id):
            return False
        tag.name = normalized[:20]
        self.save_sounds(emit_tag_changed=True)
        return True

    def delete_tag(self, tag_id: str) -> bool:
        tag = self.get_tag(tag_id)
        if tag is None:
            return False
        self._tags = [item for item in self._tags if item.id != tag_id]
        for sound in self._sounds:
            sound.tags = [item for item in sound.tags if item != tag_id]
        self._normalize_tag_order()
        self.save_sounds(emit_tag_changed=True)
        return True

    def toggle_sound_tag(self, sound_id: str, tag_id: str) -> bool:
        sound = self.get_sound(sound_id)
        tag = self.get_tag(tag_id)
        if sound is None or tag is None:
            return False
        if tag_id in sound.tags:
            sound.tags = [item for item in sound.tags if item != tag_id]
        else:
            sound.tags.append(tag_id)
        self.save_sounds(emit_tag_changed=True)
        return True

    def remove_sound_tag(self, sound_id: str, tag_id: str) -> bool:
        sound = self.get_sound(sound_id)
        if sound is None or tag_id not in sound.tags:
            return False
        sound.tags = [item for item in sound.tags if item != tag_id]
        self.save_sounds(emit_tag_changed=True)
        return True

    def set_sound_tags(self, sound_id: str, tag_ids: list[str]) -> bool:
        print(f"[DB] set_sound_tags sound_id={sound_id} tags={tag_ids}", flush=True)
        sound = self.get_sound(sound_id)
        if sound is None:
            return False
        valid_tags = {tag.id for tag in self._tags}
        sound.tags = [tag_id for tag_id in tag_ids if tag_id in valid_tags]
        self.save_sounds(emit_tag_changed=True)
        return True

    def move_tag_before(self, source_id: str, target_id: str) -> bool:
        if source_id == target_id:
            return False
        ordered = self.all_tags()
        source = next((item for item in ordered if item.id == source_id), None)
        target = next((item for item in ordered if item.id == target_id), None)
        if source is None or target is None:
            return False
        ordered.remove(source)
        ordered.insert(ordered.index(target), source)
        self._tags = ordered
        for index, tag in enumerate(self._tags):
            tag.sort_order = index
        self.save_sounds(emit_tag_changed=True)
        return True

    def move_sound_before(self, source_id: str, target_id: str) -> bool:
        if source_id == target_id:
            return False
        ordered = self.all_sounds()
        source = next((item for item in ordered if item.id == source_id), None)
        target = next((item for item in ordered if item.id == target_id), None)
        if source is None or target is None:
            return False
        ordered.remove(source)
        ordered.insert(ordered.index(target), source)
        self._sounds = ordered
        for index, sound in enumerate(self._sounds):
            sound.sort_order = index
        self.save_sounds()
        return True

    def next_sound_sort_order(self) -> int:
        return max((sound.sort_order for sound in self._sounds), default=-1) + 1

    def next_bgm_sort_order(self) -> int:
        return max((bgm.sort_order for bgm in self._bgm), default=-1) + 1

    def save_sounds(self, *, emit_tag_changed: bool = False) -> None:
        payload = {
            "sounds": [sound.to_dict() for sound in self.all_sounds()],
            "tags": [tag.to_dict() for tag in self.all_tags()],
        }
        self._write_json(SOUNDS_DB_PATH, payload)
        self.sounds_changed.emit()
        if emit_tag_changed:
            self.tag_changed.emit()

    def save_bgms(self) -> None:
        payload = {
            "bgm": [bgm.to_dict() for bgm in self.all_bgms()],
        }
        self._write_json(BGM_DB_PATH, payload)
        self.bgm_changed.emit()

    def save_config(self) -> None:
        self._write_json(CONFIG_PATH, self._config)
        self.config_changed.emit(self.config())

    def update_config(self, updates: dict[str, object]) -> None:
        self._config = self._merge_dicts(self._config, updates)
        self.save_config()

    def set_output_device(self, device: str | int) -> None:
        self._config["output_device"] = device
        self.save_config()

    def set_hotkey_mode(self, mode: str) -> None:
        self._config["hotkey_mode"] = mode
        self.save_config()

    def set_floating_window_state(
        self,
        *,
        visible: bool | None = None,
        x: int | None = None,
        y: int | None = None,
    ) -> None:
        floating = dict(self._config.get("floating_window", {}))
        if visible is not None:
            floating["visible"] = visible
        if x is not None:
            floating["x"] = x
        if y is not None:
            floating["y"] = y
        self._config["floating_window"] = floating
        self.save_config()

    def _normalize_sound_order(self) -> None:
        for index, sound in enumerate(sorted(self._sounds, key=lambda item: item.sort_order)):
            sound.sort_order = index
        self._sounds.sort(key=lambda item: item.sort_order)

    def _normalize_tag_order(self) -> None:
        for index, tag in enumerate(sorted(self._tags, key=lambda item: item.sort_order)):
            tag.sort_order = index
        self._tags.sort(key=lambda item: item.sort_order)

    def _normalize_bgm_order(self) -> None:
        for index, bgm in enumerate(sorted(self._bgm, key=lambda item: item.sort_order)):
            bgm.sort_order = index
        self._bgm.sort(key=lambda item: item.sort_order)

    def _tag_name_exists(self, name: str, *, exclude_id: str | None = None) -> bool:
        lowered = name.strip().lower()
        return any(
            tag.id != exclude_id and tag.name.strip().lower() == lowered
            for tag in self._tags
        )

    @staticmethod
    def _read_json(path: Path, fallback: dict[str, object]) -> dict[str, object]:
        try:
            with path.open("r", encoding="utf-8") as handle:
                return json.load(handle)
        except (FileNotFoundError, json.JSONDecodeError):
            return deepcopy(fallback)

    @staticmethod
    def _write_json(path: Path, payload: dict[str, object]) -> None:
        with path.open("w", encoding="utf-8") as handle:
            json.dump(payload, handle, ensure_ascii=False, indent=2)

    @staticmethod
    def _merge_dicts(base: dict[str, object], incoming: dict[str, object]) -> dict[str, object]:
        result = deepcopy(base)
        for key, value in incoming.items():
            if isinstance(value, dict) and isinstance(result.get(key), dict):
                result[key] = Database._merge_dicts(result[key], value)
            else:
                result[key] = value
        return result


db = Database()
