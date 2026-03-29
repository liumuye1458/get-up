from __future__ import annotations

from models.db import db


def _normalize_hotkey(hotkey_str: str) -> str:
    return hotkey_str.strip().lower()


def _system_name_key(key: str) -> str:
    if key == "minimize_window":
        return "settings.hotkey.toggle_window"
    return f"settings.hotkey.{key}"


def check_hotkey_conflict(
    hotkey_str: str,
    exclude_type: str | None = None,
    exclude_id: str | None = None,
) -> dict[str, str] | None:
    """
    检测快捷键是否与已有的音效 / BGM / 系统功能冲突。

    返回:
        None: 无冲突
        {"type": "sound"|"bgm"|"system", "name": "..."}: 冲突项
    """
    normalized = _normalize_hotkey(hotkey_str)
    if not normalized:
        return None

    for sound in db.all_sounds():
        if exclude_type == "sound" and sound.id == exclude_id:
            continue
        if _normalize_hotkey(sound.hotkey) == normalized:
            return {"type": "sound", "name": sound.name}

    for bgm in db.all_bgms():
        if exclude_type == "bgm" and bgm.id == exclude_id:
            continue
        if _normalize_hotkey(bgm.hotkey) == normalized:
            return {"type": "bgm", "name": bgm.name}

    hotkeys = dict(db.config().get("hotkeys", {}))
    for key, value in hotkeys.items():
        if exclude_type == "system" and str(key) == exclude_id:
            continue
        if _normalize_hotkey(str(value or "")) == normalized:
            return {"type": "system", "name": _system_name_key(str(key))}

    return None
