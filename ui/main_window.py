from __future__ import annotations

from pathlib import Path

from PyQt6.QtGui import QAction, QCloseEvent, QIcon
from PyQt6.QtCore import QMetaObject, Qt, Q_ARG, pyqtSlot
from PyQt6.QtWidgets import QApplication, QFileDialog, QFrame, QHBoxLayout, QMainWindow, QMenu, QMessageBox, QProgressDialog, QStackedWidget, QStatusBar, QSystemTrayIcon, QVBoxLayout, QWidget

from config import ASSETS_DIR
from core.audio_engine import BGMPlayer, audio_engine
from core.backup_manager import BackupManager
from core.hotkey_manager import hotkey_manager
from core.i18n_manager import I18nManager, t
from models.db import db
from ui.dialogs.sound_edit_dialog import SoundEditDialog
from ui.bottom_bar import BottomBar
from ui.floating_window import FloatingWindow
from ui.pages.backup_page import BackupPage
from ui.pages.bgm_page import BgmPage
from ui.pages.help_page import HelpPage
from ui.pages.settings_page import SettingsPage
from ui.pages.sounds_page import SoundsPage
from ui.sidebar import Sidebar
from utils.audio_utils import import_audio_file


class MainWindow(QMainWindow):
    def __init__(self) -> None:
        super().__init__()
        self._quitting = False
        self.setMinimumSize(900, 560)
        self.resize(1200, 700)
        app_icon = ASSETS_DIR / "icon.png"
        if app_icon.exists():
            self.setWindowIcon(QIcon(str(app_icon)))

        central_widget = QFrame(self)
        central_widget.setObjectName("AppFrame")
        self.setCentralWidget(central_widget)
        root_layout = QVBoxLayout(central_widget)
        root_layout.setContentsMargins(0, 0, 0, 0)
        root_layout.setSpacing(0)

        body_widget = QWidget(central_widget)
        body_layout = QHBoxLayout(body_widget)
        body_layout.setContentsMargins(0, 0, 0, 0)
        body_layout.setSpacing(0)

        self.sidebar = Sidebar(body_widget)
        self.sidebar.page_selected.connect(self._select_page)
        body_layout.addWidget(self.sidebar)

        self.stack = QStackedWidget(body_widget)
        body_layout.addWidget(self.stack, 1)
        root_layout.addWidget(body_widget, stretch=1)

        self.sounds_page = SoundsPage(self)
        self.bgm_page = BgmPage(self)
        self.backup_page = BackupPage(main_window=self, parent=self)
        self.settings_page = SettingsPage(main_window=self, parent=self)
        self.help_page = HelpPage(self)
        self.stack.addWidget(self.sounds_page)
        self.stack.addWidget(self.bgm_page)
        self.stack.addWidget(self.backup_page)
        self.stack.addWidget(self.settings_page)
        self.stack.addWidget(self.help_page)
        self._backup_manager = BackupManager()

        self._bottom_bar = BottomBar(central_widget)
        self.bottom_bar = self._bottom_bar

        status_bar = QStatusBar(self)
        status_bar.setFixedHeight(48)
        status_bar.setSizeGripEnabled(False)
        status_bar.setStyleSheet(
            """
            QStatusBar {
                border: none;
                padding: 0;
                margin: 0;
                background: #1a1a2e;
            }
            QStatusBar::item {
                border: none;
            }
            """
        )
        status_bar.addPermanentWidget(self._bottom_bar, 1)
        self.setStatusBar(status_bar)

        self.floating_window = FloatingWindow()
        self._current_bgm_id: str | None = None
        hotkey_manager.set_parent(self)
        hotkey_manager.start()
        self._connect_signals()
        self._load_from_config()
        self._refresh_devices()
        self._refresh_hotkeys()
        db.sounds_changed.connect(self._refresh_hotkeys)
        self._retranslate_ui()
        self._init_tray()
        self.setWindowTitle(t("app.title"))

    def _connect_signals(self) -> None:
        self.sounds_page.play_requested.connect(self._play_sound)
        self.sounds_page.replace_requested.connect(self._replace_sound)
        self.sounds_page.edit_requested.connect(self._edit_sound)
        self.sounds_page.clip_requested.connect(self._clip_sound)
        self.sounds_page.duplicate_requested.connect(self._duplicate_sound)
        self.sounds_page.delete_requested.connect(self._delete_sound)
        self.sounds_page.hotkey_requested.connect(self._set_hotkey)
        self.sounds_page.clear_hotkey_requested.connect(self._clear_hotkey)
        self.sounds_page.status_message.connect(self.statusBar().showMessage)

        self.bottom_bar.output_device_changed.connect(self._set_output_device)
        self.bottom_bar.stop_all_requested.connect(audio_engine.stop_all)
        self.bottom_bar.hotkeys_enabled_changed.connect(self._set_hotkeys_enabled)

        self.bgm_page.play_requested.connect(self._play_bgm)
        self.bgm_page.status_message.connect(self.statusBar().showMessage)

        self.settings_page.language_changed.connect(self._change_language)
        self.settings_page.floating_visibility_changed.connect(self._toggle_floating_window)

        self.floating_window.hotkeys_enabled_changed.connect(self._set_hotkeys_enabled)
        self.floating_window.moved.connect(self._save_floating_position)

        db.config_changed.connect(self._on_config_changed)
        db.bgm_changed.connect(self._refresh_hotkeys)

        hotkey_manager.permission_warning.connect(
            lambda: self._show_status_warning(t("status.hotkey_permission"))
        )
        hotkey_manager.registration_error.connect(
            lambda message: self.statusBar().showMessage(t("status.hotkey_error", message=message), 8000)
        )
        hotkey_manager.enabled_changed.connect(self.bottom_bar.set_hotkeys_enabled)
        hotkey_manager.enabled_changed.connect(self.floating_window.set_hotkeys_enabled)
        hotkey_manager.mode_changed.connect(self._on_hotkey_mode_changed)

        audio_engine.status_message.connect(
            lambda message: self.statusBar().showMessage(t("status.audio_unavailable", message=message), 8000)
        )
        I18nManager.instance().language_changed.connect(self._on_language_changed)

    def _load_from_config(self) -> None:
        config = db.config()
        mode = str(config.get("hotkey_mode", "global"))
        if mode not in {"global", "local"}:
            mode = "global"
        hotkey_manager.switch_mode(mode)
        floating = dict(config.get("floating_window", {}))
        self.floating_window.move(int(floating.get("x", 100)), int(floating.get("y", 100)))
        self._toggle_floating_window(bool(floating.get("visible", False)), persist=False)

    def _refresh_devices(self) -> None:
        try:
            devices = audio_engine.list_output_devices()
        except Exception:  # noqa: BLE001
            devices = []
        current_device = db.config().get("output_device", "default")
        self.bottom_bar.set_devices(devices, current_device)
        audio_engine.set_output_device(current_device)

    def _refresh_hotkeys(self) -> None:
        config = db.config()
        sounds = db.all_sounds()
        sound_entries = [
            (sound.id, sound.hotkey, self._make_sound_hotkey_callback(sound.id, sound.hotkey))
            for sound in sounds
            if sound.hotkey and sound.enabled
        ]
        function_entries = self._functional_hotkey_entries(config)
        for bgm in db.all_bgms():
            if bgm.hotkey and bgm.enabled:
                function_entries.append(
                    (f"bgm_{bgm.id}", bgm.hotkey, self._make_bgm_hotkey_callback(bgm.id))
                )
        hotkey_manager.load_all(
            sound_entries,
            function_entries,
            mode=str(config.get("hotkey_mode", "global")),
            enabled=hotkey_manager.enabled,
        )
        self._on_hotkey_mode_changed(hotkey_manager.mode if hotkey_manager.enabled else "disabled")
        self.floating_window.set_switch_hotkey_text(
            str(dict(config.get("hotkeys", {})).get("stop_all_music", ""))
        )

    def _make_sound_hotkey_callback(self, sound_id: str, hotkey: str):
        def _callback() -> None:
            print(f"[HOTKEY] Triggered: {hotkey} -> sound_id={sound_id}", flush=True)
            QMetaObject.invokeMethod(
                self,
                "_invoke_sound_hotkey",
                Qt.ConnectionType.QueuedConnection,
                Q_ARG(str, sound_id),
            )

        return _callback

    def _make_bgm_hotkey_callback(self, bgm_id: str):
        def _callback() -> None:
            QMetaObject.invokeMethod(
                self,
                "_invoke_bgm_hotkey",
                Qt.ConnectionType.QueuedConnection,
                Q_ARG(str, bgm_id),
            )

        return _callback

    def _functional_hotkey_entries(self, config: dict[str, object]) -> list[tuple[str, str, object]]:
        hotkeys = dict(config.get("hotkeys", {}))

        mapping = {
            "stop_all": lambda: self._queue_functional_hotkey("stop_all"),
            "stop_all_music": lambda: self._queue_functional_hotkey("stop_all_music"),
            "bgm_play_pause": lambda: self._queue_functional_hotkey("bgm_play_pause"),
            "bgm_vol_up": lambda: self._queue_functional_hotkey("bgm_vol_up"),
            "bgm_vol_down": lambda: self._queue_functional_hotkey("bgm_vol_down"),
            "toggle_window": lambda: self._queue_functional_hotkey("toggle_window"),
            "minimize_window": lambda: self._queue_functional_hotkey("minimize_window"),
            "toggle_floating": lambda: self._queue_functional_hotkey("toggle_floating"),
        }
        entries: list[tuple[str, str, object]] = []
        for action_key, callback in mapping.items():
            combo = str(hotkeys.get(action_key, ""))
            if combo:
                entries.append((action_key, combo, callback))
        return entries

    def _queue_functional_hotkey(self, action_key: str) -> None:
        QMetaObject.invokeMethod(
            self,
            "_invoke_functional_hotkey",
            Qt.ConnectionType.QueuedConnection,
            Q_ARG(str, action_key),
        )

    @pyqtSlot(str)
    def _invoke_sound_hotkey(self, sound_id: str) -> None:
        self._play_sound(sound_id)

    @pyqtSlot(str)
    def _invoke_bgm_hotkey(self, bgm_id: str) -> None:
        self._handle_bgm_hotkey(bgm_id)

    @pyqtSlot(str)
    def _invoke_functional_hotkey(self, action_key: str) -> None:
        actions = {
            "stop_all": audio_engine.stop_all,
            "stop_all_music": self._stop_all_music,
            "bgm_play_pause": self._toggle_bgm_play_pause,
            "bgm_vol_up": lambda: self._adjust_bgm_volume(+5),
            "bgm_vol_down": lambda: self._adjust_bgm_volume(-5),
            "toggle_window": self._toggle_window_visibility,
            "minimize_window": self._toggle_window_visibility,
            "toggle_floating": self._toggle_floating,
        }
        callback = actions.get(action_key)
        if callback is not None:
            callback()

    def _play_sound(self, sound_id: str) -> None:
        sound = db.get_sound(sound_id)
        if sound is not None:
            audio_engine.play_sound(sound)

    def _play_bgm(self, bgm_id: str) -> None:
        bgm = db.get_bgm(bgm_id)
        if bgm is None or not bgm.enabled:
            return
        BGMPlayer.instance().play(bgm.library_path, bgm.volume, bgm.loop)
        self._current_bgm_id = bgm.id
        self.bottom_bar.set_current_bgm(bgm)
        self.bottom_bar.set_bgm_state(playing=True, paused=False)

    def _handle_bgm_hotkey(self, bgm_id: str) -> None:
        player = BGMPlayer.instance()
        if self._current_bgm_id == bgm_id:
            if player.is_playing:
                print(f"[BGM_HOTKEY] pause current bgm_id={bgm_id}", flush=True)
                player.pause()
                self.bottom_bar.set_bgm_state(playing=True, paused=True)
                return
            if player.is_paused:
                print(f"[BGM_HOTKEY] resume current bgm_id={bgm_id}", flush=True)
                player.resume()
                self.bottom_bar.set_bgm_state(playing=True, paused=False)
                return
        print(f"[BGM_HOTKEY] play bgm_id={bgm_id}", flush=True)
        self._play_bgm(bgm_id)

    def _toggle_bgm_play_pause(self) -> None:
        self.bottom_bar._on_play_pause()

    def _adjust_bgm_volume(self, delta: int) -> None:
        current = self.bottom_bar._vol_slider.value()
        self.bottom_bar._vol_slider.setValue(max(0, min(100, current + delta)))

    def _stop_all_music(self) -> None:
        audio_engine.stop_all()
        BGMPlayer.instance().stop()
        self._current_bgm_id = None
        self.bottom_bar.set_bgm_state(playing=False, paused=False)
        print("[ACTION] Stopped all music (sounds + BGM)", flush=True)

    def _toggle_window_visibility(self) -> None:
        if self.isHidden():
            self._restore_window()
            return
        if self.isMinimized():
            self._restore_window()
            return
        self.showMinimized()

    def _replace_sound(self, sound_id: str) -> None:
        sound = db.get_sound(sound_id)
        if sound is None:
            return
        filters = "Audio Files (*.mp3 *.wav *.ogg *.flac *.aac *.m4a)"
        file_path, _ = QFileDialog.getOpenFileName(self, t("card.replace"), "", filters)
        if not file_path:
            return
        try:
            stored = import_audio_file(Path(file_path), Path(sound.library_path).parent)
            if stored is None:
                return
            sound.library_path = str(stored)
            sound.original_filename = Path(file_path).name
            db.update_sound(sound)
        except Exception as exc:  # noqa: BLE001
            self.statusBar().showMessage(str(exc), 8000)

    def _duplicate_sound(self, sound_id: str) -> None:
        db.duplicate_sound(sound_id)

    def _edit_sound(self, sound_id: str) -> None:
        sound = db.get_sound(sound_id)
        if sound is None:
            return
        dialog = SoundEditDialog(sound, initial_tab=0, parent=self)
        dialog.exec()

    def _clip_sound(self, sound_id: str) -> None:
        sound = db.get_sound(sound_id)
        if sound is None:
            return
        dialog = SoundEditDialog(sound, initial_tab=2, parent=self)
        dialog.exec()

    def _delete_sound(self, sound_id: str) -> None:
        sound = db.get_sound(sound_id)
        if sound is None:
            return
        confirmed = QMessageBox.question(
            self,
            t("dialog.delete_title"),
            t("dialog.confirm_delete", name=sound.name),
        )
        if confirmed != QMessageBox.StandardButton.Yes:
            return
        removed = db.delete_sound(sound_id)
        if removed is None:
            return
        path = Path(removed.library_path)
        if path.exists() and not any(item.library_path == removed.library_path for item in db.all_sounds()):
            path.unlink(missing_ok=True)

    def _set_hotkey(self, sound_id: str) -> None:
        sound = db.get_sound(sound_id)
        if sound is None:
            return
        dialog = SoundEditDialog(sound, initial_tab=1, parent=self)
        dialog.exec()

    def _clear_hotkey(self, sound_id: str) -> None:
        sound = db.get_sound(sound_id)
        if sound is None:
            return
        sound.hotkey = ""
        db.update_sound(sound)

    def _set_output_device(self, device) -> None:  # type: ignore[no-untyped-def]
        db.set_output_device(device)
        audio_engine.set_output_device(device)

    def _set_hotkeys_enabled(self, enabled: bool) -> None:
        hotkey_manager.set_enabled(enabled)
        self._on_hotkey_mode_changed(hotkey_manager.mode if enabled else "disabled")

    def _on_hotkey_mode_changed(self, mode: str) -> None:
        self.floating_window.set_mode_label(mode)

    def _show_status_warning(self, message: str) -> None:
        self.statusBar().setStyleSheet("color: #facc15;")
        self.statusBar().showMessage(message, 8000)

    def _change_language(self, language: str) -> None:
        current = db.config().get("language", "zh")
        if language == current:
            return
        db.update_config({"language": language})
        I18nManager.load(language)

    def _toggle_floating_window(self, visible: bool, *, persist: bool = True) -> None:
        self.floating_window.setVisible(visible)
        if persist:
            db.set_floating_window_state(visible=visible)

    def _save_floating_position(self, x: int, y: int) -> None:
        db.set_floating_window_state(x=x, y=y)

    def _select_page(self, index: int) -> None:
        self.stack.setCurrentIndex(index)
        self.sidebar.select_page(index)

    def _on_config_changed(self, _config: dict) -> None:
        self.settings_page.refresh()

    def _on_language_changed(self) -> None:
        self.setWindowTitle(t("app.title"))
        self.sidebar._retranslate_ui()
        self.sounds_page._retranslate_ui()
        self.bgm_page._retranslate_ui()
        self.backup_page._retranslate_ui()
        self.settings_page._retranslate_ui()
        self.help_page._retranslate_ui()
        self.bottom_bar._retranslate_ui()
        if self.floating_window is not None:
            self.floating_window._retranslate_ui()
        if hasattr(self, "_tray_action_show"):
            self._tray_action_show.setText(t("tray.show"))
            self._tray_action_floating.setText(t("tray.hide_floating"))
            self._tray_action_quit.setText(t("tray.quit"))
            self._tray.setToolTip(t("app.title"))

    def refresh_all(self) -> None:
        self.sounds_page.refresh()
        self.bgm_page.refresh()
        self.settings_page.refresh()
        self._refresh_hotkeys()

    def _do_import_backup(self, zip_path: str, mode: str) -> None:
        progress = QProgressDialog(t("backup.import_progress"), None, 0, 100, self)
        progress.setWindowTitle(t("common.importing"))
        progress.setWindowModality(Qt.WindowModality.WindowModal)
        progress.setCancelButton(None)
        progress.setMinimumDuration(0)
        progress.setValue(0)

        def on_progress(current: int, total: int) -> None:
            pct = int(current / total * 100) if total > 0 else 0
            progress.setValue(pct)
            QApplication.processEvents()

        ok, message = self._backup_manager.import_backup(zip_path, mode=mode, progress_cb=on_progress)
        progress.setValue(100)
        progress.close()

        if ok:
            db.load()
            self.refresh_all()
            QMessageBox.information(self, t("backup.import_success_title"), t("backup.import_done"))
            return
        QMessageBox.critical(self, t("backup.import_fail_title"), t("common.error_message", message=message))

    def _do_export_backup(self, zip_path: str) -> None:
        progress = QProgressDialog(t("backup.export_progress"), None, 0, 100, self)
        progress.setWindowTitle(t("common.exporting"))
        progress.setWindowModality(Qt.WindowModality.WindowModal)
        progress.setMinimumDuration(0)
        progress.setValue(0)

        def on_progress(current: int, total: int) -> None:
            pct = int(current / total * 100) if total > 0 else 0
            progress.setValue(pct)
            QApplication.processEvents()

        ok, message = self._backup_manager.export_backup(zip_path, progress_cb=on_progress)
        progress.setValue(100)
        progress.close()

        if ok:
            QMessageBox.information(self, t("backup.export_success_title"), t("backup.export_done"))
            return
        QMessageBox.critical(self, t("backup.export_fail_title"), t("common.error_message", message=message))

    def _retranslate_ui(self, *_args) -> None:
        self.setWindowTitle(t("app.title"))

    def _init_tray(self) -> None:
        icon_file = ASSETS_DIR / "icon.png"
        icon = QIcon(str(icon_file)) if icon_file.exists() else QIcon()

        self._tray = QSystemTrayIcon(icon, self)
        self._tray.setToolTip(t("app.title"))

        menu = QMenu(self)
        self._tray_action_show = QAction(t("tray.show"), self)
        self._tray_action_show.triggered.connect(self._restore_window)

        self._tray_action_floating = QAction(t("tray.hide_floating"), self)
        self._tray_action_floating.triggered.connect(self._toggle_floating)

        self._tray_action_quit = QAction(t("tray.quit"), self)
        self._tray_action_quit.triggered.connect(self._quit_app)

        menu.addAction(self._tray_action_show)
        menu.addAction(self._tray_action_floating)
        menu.addSeparator()
        menu.addAction(self._tray_action_quit)

        self._tray.setContextMenu(menu)
        self._tray.activated.connect(self._on_tray_activated)
        self._tray.show()

    def _on_tray_activated(self, reason) -> None:  # type: ignore[no-untyped-def]
        if reason == QSystemTrayIcon.ActivationReason.DoubleClick:
            self._restore_window()

    def _restore_window(self) -> None:
        self.showNormal()
        self.raise_()
        self.activateWindow()

    def _toggle_floating(self) -> None:
        self._toggle_floating_window(not self.floating_window.isVisible())

    def _quit_app(self) -> None:
        self._quitting = True
        try:
            BGMPlayer.instance().stop()
        except Exception:
            pass
        try:
            audio_engine.stop_all()
        except Exception:
            pass
        try:
            hotkey_manager.unregister_all()
            hotkey_manager.stop()
        except Exception:
            pass
        self._tray.hide()
        QApplication.quit()

    def closeEvent(self, event: QCloseEvent) -> None:
        if self._quitting:
            hotkey_manager.unregister_all()
            hotkey_manager.stop()
            BGMPlayer.instance().stop()
            audio_engine.cleanup()
            self.floating_window.close()
            event.accept()
            return

        event.ignore()
        self.hide()
        self._tray.showMessage(
            t("app.title"),
            t("tray.minimized_msg"),
            QSystemTrayIcon.MessageIcon.Information,
            2000,
        )
