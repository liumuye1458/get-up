from __future__ import annotations

import json
import sys
from pathlib import Path

from PyQt6.QtCore import QObject, pyqtSignal

from config import APP_ROOT, I18N_DIR, RESOURCE_ROOT


class I18nManager(QObject):
    language_changed = pyqtSignal()
    _instance: "I18nManager" | None = None
    events: "I18nManager"

    def __init__(self) -> None:
        super().__init__()
        self._data: dict[str, str] = {}
        self._lang = "zh"

    @classmethod
    def instance(cls) -> "I18nManager":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def _load(self, lang: str) -> None:
        resolved = self._resolve_lang(lang)
        if resolved is None:
            raise FileNotFoundError(f"i18n file not found for language: {lang}")
        path, resolved_lang = resolved
        self._data = json.loads(path.read_text(encoding="utf-8-sig"))
        self._lang = resolved_lang
        self.language_changed.emit()

    def _candidate_dirs(self) -> list[Path]:
        candidates = [I18N_DIR, RESOURCE_ROOT / "i18n", APP_ROOT / "_internal" / "i18n"]
        if getattr(sys, "frozen", False):
            exe_parent = Path(sys.executable).resolve().parent
            candidates.append(exe_parent / "_internal" / "i18n")
            meipass = getattr(sys, "_MEIPASS", None)
            if meipass:
                candidates.append(Path(meipass) / "i18n")
        candidates.append(Path(__file__).resolve().parent.parent / "i18n")

        unique: list[Path] = []
        seen: set[str] = set()
        for candidate in candidates:
            key = str(candidate)
            if key not in seen:
                seen.add(key)
                unique.append(candidate)
        return unique

    def _resolve_lang(self, lang: str) -> tuple[Path, str] | None:
        for base in self._candidate_dirs():
            path = base / f"{lang}.json"
            if path.exists():
                return path, lang
        if lang != "zh":
            for base in self._candidate_dirs():
                fallback = base / "zh.json"
                if fallback.exists():
                    return fallback, "zh"
        return None

    def _translate(self, key: str, **kwargs: object) -> str:
        text = self._data.get(key, key)
        return text.format(**kwargs) if kwargs else text

    @classmethod
    def load(cls, lang: str) -> None:
        cls.instance()._load(lang)

    @classmethod
    def current_language(cls) -> str:
        return cls.instance()._lang

    @classmethod
    def t(cls, key: str, **kwargs: object) -> str:
        return cls.instance()._translate(key, **kwargs)

    @classmethod
    def available_languages(cls) -> list[str]:
        return [path.stem for path in sorted(I18N_DIR.glob("*.json")) if path.is_file()]


I18nManager.events = I18nManager.instance()


def t(key: str, **kwargs: object) -> str:
    return I18nManager.t(key, **kwargs)
