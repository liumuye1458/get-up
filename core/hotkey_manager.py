from __future__ import annotations

from collections.abc import Callable

from PyQt6.QtCore import QObject, pyqtSignal
from PyQt6.QtGui import QKeySequence, QShortcut
from PyQt6.QtWidgets import QWidget
from pynput import keyboard


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
        self._started = False
        self._sound_bindings: dict[str, tuple[str, Callable[[], None]]] = {}
        self._function_bindings: dict[str, tuple[str, Callable[[], None]]] = {}
        self._listener: keyboard.GlobalHotKeys | None = None
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

    def start(self) -> None:
        self._started = True
        self.reload_all()

    def stop(self) -> None:
        self._started = False
        self.unregister_all()

    def set_enabled(self, enabled: bool) -> None:
        if self._enabled == enabled:
            return
        self._enabled = enabled
        self.reload_all()
        self.enabled_changed.emit(enabled)

    def switch_mode(self, mode: str) -> None:
        self._mode = mode
        self.reload_all()
        self.mode_changed.emit(mode)

    def register_sound(self, sound_id: str, hotkey: str, callback: Callable[[], None]) -> None:
        self.unregister_sound(sound_id)
        self._sound_bindings[sound_id] = (hotkey, callback)
        self.reload_all()

    def unregister_sound(self, sound_id: str) -> None:
        self._sound_bindings.pop(sound_id, None)
        self.reload_all()

    def register_function(self, key: str, hotkey: str, callback: Callable[[], None]) -> None:
        self.unregister_function(key)
        self._function_bindings[key] = (hotkey, callback)
        self.reload_all()

    def unregister_function(self, key: str) -> None:
        self._function_bindings.pop(key, None)
        self.reload_all()

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
            key: (hotkey, callback)
            for key, hotkey, callback in function_entries
            if hotkey
        }
        self.reload_all()

    def reload_all(self) -> None:
        self.unregister_all()
        if not self._started or not self._enabled:
            return

        if self._mode == "global":
            hotkeys: dict[str, Callable[[], None]] = {}
            for sound_id, (hotkey, callback) in self._sound_bindings.items():
                self._add_global_binding(hotkeys, f"sound:{sound_id}", hotkey, callback)
            for key, (hotkey, callback) in self._function_bindings.items():
                self._add_global_binding(hotkeys, f"fn:{key}", hotkey, callback)
            if hotkeys:
                try:
                    self._listener = keyboard.GlobalHotKeys(hotkeys)
                    self._listener.start()
                    print("[HOTKEY_MGR] Listener started", flush=True)
                except Exception as exc:  # noqa: BLE001
                    self.registration_error.emit(str(exc))
            return

        for sound_id, (hotkey, callback) in self._sound_bindings.items():
            self._register_local(f"sound:{sound_id}", hotkey, callback)
        for key, (hotkey, callback) in self._function_bindings.items():
            self._register_local(f"fn:{key}", hotkey, callback)

    def unregister_all(self) -> None:
        if self._listener is not None:
            try:
                self._listener.stop()
            except Exception:
                pass
            self._listener = None
        for shortcut in self._shortcuts:
            shortcut.setParent(None)
        self._shortcuts.clear()

    def _add_global_binding(
        self,
        bucket: dict[str, Callable[[], None]],
        tag: str,
        hotkey: str,
        callback: Callable[[], None],
    ) -> None:
        combo = self._to_pynput_combo(hotkey)
        if not combo:
            return
        print(f"[HOTKEY] Registered: {hotkey} -> {tag}", flush=True)
        bucket[combo] = lambda current_hotkey=hotkey, current_callback=callback: self._invoke(
            current_hotkey,
            current_callback,
        )

    def _register_local(self, tag: str, hotkey: str, callback: Callable[[], None]) -> QShortcut | None:
        if not hotkey or self._parent_widget is None:
            return None
        shortcut = QShortcut(QKeySequence(hotkey), self._parent_widget)
        shortcut.activated.connect(
            lambda current_hotkey=hotkey, current_callback=callback: self._invoke(
                current_hotkey,
                current_callback,
            )
        )
        self._shortcuts.append(shortcut)
        print(f"[HOTKEY] Registered: {hotkey} -> {tag}", flush=True)
        return shortcut

    def _invoke(self, hotkey: str, callback: Callable[[], None]) -> None:
        print(f"[HOTKEY] Triggered: {hotkey}", flush=True)
        try:
            callback()
        except Exception as exc:  # noqa: BLE001
            print(f"[HOTKEY] Callback error: {exc}", flush=True)
            self.registration_error.emit(str(exc))

    def _to_pynput_combo(self, hotkey: str) -> str:
        parts = [part.strip().lower() for part in hotkey.split("+") if part.strip()]
        converted: list[str] = []
        for part in parts:
            if part in {"ctrl", "control", "control_l", "control_r"}:
                converted.append("<ctrl>")
            elif part in {"shift", "shift_l", "shift_r"}:
                converted.append("<shift>")
            elif part in {"alt", "alt_l", "alt_r", "alt_gr"}:
                converted.append("<alt>")
            elif part in {"cmd", "super", "meta", "windows"}:
                converted.append("<cmd>")
            elif part in {"enter", "return", "space", "tab", "esc", "escape", "backspace"}:
                name = "esc" if part in {"esc", "escape"} else part
                converted.append(f"<{name}>")
            elif part.startswith("f") and part[1:].isdigit():
                converted.append(f"<{part}>")
            else:
                converted.append(part)
        return "+".join(converted)


hotkey_manager = HotkeyManager.instance()
