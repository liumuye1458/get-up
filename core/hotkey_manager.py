from __future__ import annotations

from collections.abc import Callable
import logging

from PyQt6.QtCore import QObject, pyqtSignal
from PyQt6.QtGui import QKeySequence, QShortcut
from PyQt6.QtWidgets import QWidget

import keyboard


class HotkeyManager(QObject):
    _instance: "HotkeyManager" | None = None
    permission_warning = pyqtSignal()
    registration_error = pyqtSignal(str)
    enabled_changed = pyqtSignal(bool)
    mode_changed = pyqtSignal(str)

    @classmethod
    def instance(cls) -> "HotkeyManager":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def __init__(self) -> None:
        super().__init__()
        self._mode = "global"
        self._enabled = True
        self._sound_bindings: dict[str, tuple[str, Callable[[], None]]] = {}
        self._function_bindings: dict[str, tuple[str, Callable[[], None]]] = {}
        self._keyboard_handles: dict[str, int] = {}
        self._shortcuts: list[QShortcut] = []
        self._parent_widget: QWidget | None = None

    @property
    def mode(self) -> str:
        return self._mode

    @property
    def enabled(self) -> bool:
        return self._enabled

    def set_parent(self, widget: QWidget) -> None:
        self._parent_widget = widget

    def set_enabled(self, enabled: bool) -> None:
        if self._enabled == enabled:
            return
        self._enabled = enabled
        if enabled:
            self.reload_all()
        else:
            self.unregister_all()
        self.enabled_changed.emit(enabled)

    def switch_mode(self, mode: str) -> None:
        self._mode = mode
        self.reload_all()
        self.mode_changed.emit(mode)

    def register_sound(self, sound_id: str, hotkey: str, callback: Callable[[], None]) -> None:
        self.unregister_sound(sound_id)
        self._sound_bindings[sound_id] = (hotkey, callback)
        if not hotkey:
            return
        if not self._enabled or self._mode != "global":
            return
        self._add_handle(f"sound:{sound_id}", hotkey, callback)

    def unregister_sound(self, sound_id: str) -> None:
        self._sound_bindings.pop(sound_id, None)
        self._remove_handle(f"sound:{sound_id}")

    def register_function(self, key: str, hotkey: str, callback: Callable[[], None]) -> None:
        self.unregister_function(key)
        self._function_bindings[key] = (hotkey, callback)
        if not hotkey:
            return
        if not self._enabled or self._mode != "global":
            return
        self._add_handle(f"fn:{key}", hotkey, callback)

    def unregister_function(self, key: str) -> None:
        self._function_bindings.pop(key, None)
        self._remove_handle(f"fn:{key}")

    def load_all(
        self,
        sound_entries: list[tuple[str, str, Callable[[], None]]],
        function_entries: list[tuple[str, str, Callable[[], None]]],
        *,
        mode: str = "global",
        enabled: bool = True,
    ) -> None:
        self._mode = mode
        self._enabled = enabled
        self._sound_bindings = {
            sound_id: (hotkey, callback)
            for sound_id, hotkey, callback in sound_entries
            if hotkey
        }
        self._function_bindings = {
            key: (hotkey, callback) for key, hotkey, callback in function_entries if hotkey
        }
        self.reload_all()

    def reload_all(self) -> None:
        self.unregister_all()
        if not self._enabled:
            return

        for sound_id, (hotkey, callback) in self._sound_bindings.items():
            if self._mode == "global":
                self._add_handle(f"sound:{sound_id}", hotkey, callback)
            else:
                self._register_local(hotkey, callback)
        for key, (hotkey, callback) in self._function_bindings.items():
            if self._mode == "global":
                self._add_handle(f"fn:{key}", hotkey, callback)
            else:
                self._register_local(hotkey, callback)

    def unregister_all(self) -> None:
        for binding_id in list(self._keyboard_handles):
            self._remove_handle(binding_id)
        for shortcut in self._shortcuts:
            shortcut.setParent(None)
        self._shortcuts.clear()

    def _add_handle(self, binding_id: str, hotkey: str, callback: Callable[[], None]) -> None:
        if not hotkey:
            return
        try:
            self._keyboard_handles[binding_id] = keyboard.add_hotkey(hotkey, callback)
            logging.warning(f"[HotkeyManager] 已注册全局热键: {hotkey}")
        except PermissionError:
            self.permission_warning.emit()
            self.switch_mode("local")
        except Exception as exc:  # noqa: BLE001
            self.registration_error.emit(str(exc))

    def _register_local(self, hotkey: str, callback: Callable[[], None]) -> QShortcut | None:
        if not hotkey or self._parent_widget is None:
            return None
        shortcut = QShortcut(QKeySequence(hotkey), self._parent_widget)
        shortcut.activated.connect(callback)
        self._shortcuts.append(shortcut)
        return shortcut

    def _remove_handle(self, binding_id: str) -> None:
        handle = self._keyboard_handles.pop(binding_id, None)
        if handle is None:
            return
        try:
            keyboard.remove_hotkey(handle)
        except KeyError:
            pass

hotkey_manager = HotkeyManager.instance()
