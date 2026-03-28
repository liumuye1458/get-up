from __future__ import annotations

import json

from PyQt6.QtCore import QObject, pyqtSignal

from config import I18N_DIR


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
        path = I18N_DIR / f"{lang}.json"
        if not path.exists():
            path = I18N_DIR / "zh.json"
            lang = "zh"
        self._data = json.loads(path.read_text(encoding="utf-8"))
        self._lang = lang
        self.language_changed.emit()

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
