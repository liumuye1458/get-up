from __future__ import annotations

from pathlib import Path

from PyQt6.QtGui import QAction, QCloseEvent, QIcon
from PyQt6.QtCore import Qt
from PyQt6.QtWidgets import QApplication, QFileDialog, QFrame, QHBoxLayout, QMainWindow, QMenu, QMessageBox, QProgressDialog, QStackedWidget, QSystemTrayIcon, QVBoxLayout, QWidget

from config import ASSETS_DIR, ICONS_DIR
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
        app_icon = ICONS_DIR / "app.svg"
        if app_icon.exists():
            self.setWindowIcon(QIcon(str(app_icon)))

        root = QFrame(self)
        root.setObjectName("AppFrame")
        self.setCentralWidget(root)
        root_layout = QVBoxLayout(root)
        root_layout.setContentsMargins(0, 0, 0, 0)
        root_layout.setSpacing(0)

        body = QWidget(root)
        body_layout = QHBoxLayout(body)
        body_layout.setContentsMargins(0, 0, 0, 0)
        body_layout.setSpacing(0)

        self.sidebar = Sidebar(body)
        self.sidebar.page_selected.connect(self._select_page)
        body_layout.addWidget(self.sidebar)

        self.stack = QStackedWidget(body)
        body_layout.addWidget(self.stack, 1)
        root_layout.addWidget(body, 1)

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

        self.bottom_bar = BottomBar(root)
        root_layout.addWidget(self.bottom_bar)

        self.floating_window = FloatingWindow()
        self._current_bgm_id: str | None = None
        hotkey_manager.set_parent(self)
        self._connect_signals()
        self._load_from_config()
        self._refresh_devices()
        self._refresh_hotkeys()
        db.sounds_changed.connect(self._refresh_hotkeys)
        self._retranslate_ui()
        self.statusBar().showMessage(t("status.ready"))
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
            (sound.id, sound.hotkey, lambda current=sound: self._play_sound(current.id))
            for sound in sounds
            if sound.hotkey and sound.enabled
        ]
        function_entries = []
        stop_all_hotkey = str(dict(config.get("hotkeys", {})).get("stop_all", ""))
        if stop_all_hotkey:
            function_entries.append(("stop_all", stop_all_hotkey, audio_engine.stop_all))
        for bgm in db.all_bgms():
            if bgm.hotkey and bgm.enabled:
                function_entries.append(
                    (f"bgm_{bgm.id}", bgm.hotkey, lambda current=bgm: self._play_bgm(current.id))
                )
        hotkey_manager.load_all(
            sound_entries,
            function_entries,
            mode=str(config.get("hotkey_mode", "global")),
            enabled=hotkey_manager.enabled,
        )
        self._on_hotkey_mode_changed(hotkey_manager.mode if hotkey_manager.enabled else "disabled")
        self.floating_window.set_switch_hotkey_text(
            str(dict(config.get("hotkeys", {})).get("toggle_hotkey_mode", ""))
        )

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
        mode = "global" if enabled else "local"
        db.update_config({"hotkey_mode": mode})
        hotkey_manager.switch_mode(mode)
        self._on_hotkey_mode_changed(mode)

    def _on_hotkey_mode_changed(self, mode: str) -> None:
        self.bottom_bar.set_hotkeys_enabled(mode == "global")
        self.floating_window.set_hotkeys_enabled(mode == "global")
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
        self.statusBar().showMessage(t("status.ready"))

    def refresh_all(self) -> None:
        self.sounds_page.refresh()
        self.bgm_page.refresh()
        self.settings_page.refresh()
        self._refresh_hotkeys()

    def _do_import_backup(self, zip_path: str, mode: str) -> None:
        progress = QProgressDialog("正在导入备份...", None, 0, 100, self)
        progress.setWindowTitle("导入中")
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
            QMessageBox.information(self, "导入成功", "备份已成功导入。")
            return
        QMessageBox.critical(self, "导入失败", f"错误：{message}")

    def _retranslate_ui(self, *_args) -> None:
        self.setWindowTitle(t("app.title"))

    def _init_tray(self) -> None:
        icon_file = ASSETS_DIR / "icons" / "app.png"
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
        except Exception:
            pass
        self._tray.hide()
        QApplication.quit()

    def closeEvent(self, event: QCloseEvent) -> None:
        if self._quitting:
            hotkey_manager.unregister_all()
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
