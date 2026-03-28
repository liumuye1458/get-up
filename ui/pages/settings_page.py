from __future__ import annotations

from PyQt6.QtCore import pyqtSignal
from PyQt6.QtWidgets import (
    QCheckBox,
    QComboBox,
    QDialog,
    QGroupBox,
    QHBoxLayout,
    QLabel,
    QMessageBox,
    QPushButton,
    QRadioButton,
    QScrollArea,
    QVBoxLayout,
    QWidget,
)

from config import SUPPORTED_LANGUAGES
from core.audio_engine import audio_engine
from core.hotkey_manager import hotkey_manager
from core.i18n_manager import I18nManager, t
from models.db import db
from ui.dialogs.hotkey_capture_dialog import HotkeyCaptureDialog


class SettingsPage(QWidget):
    language_changed = pyqtSignal(str)
    floating_visibility_changed = pyqtSignal(bool)

    def __init__(self, main_window=None, parent=None) -> None:
        super().__init__(parent)
        self._mw = main_window
        self._hotkey_rows: dict[str, tuple[QLabel, QLabel, QPushButton, QPushButton]] = {}
        self._loading = False
        self._setup_ui()
        self.refresh()

        I18nManager.events.language_changed.connect(self._retranslate_ui)

    def _setup_ui(self) -> None:
        outer = QVBoxLayout(self)
        outer.setContentsMargins(20, 16, 20, 16)
        outer.setSpacing(14)

        self._title = QLabel(self)
        self._title.setObjectName("PageTitle")
        outer.addWidget(self._title)

        scroll = QScrollArea(self)
        scroll.setWidgetResizable(True)
        scroll.setFrameShape(scroll.Shape.NoFrame)

        inner = QWidget(scroll)
        layout = QVBoxLayout(inner)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(14)

        self._grp_audio, audio_layout = self._create_group(layout)
        self._device_label = QLabel(self)
        self._device_combo = QComboBox(self)
        self._device_combo.setMaximumWidth(260)
        self._device_combo.setSizeAdjustPolicy(
            QComboBox.SizeAdjustPolicy.AdjustToMinimumContentsLengthWithIcon
        )
        self._device_combo.setMinimumContentsLength(28)
        self._device_combo.currentIndexChanged.connect(self._on_device_changed)
        audio_layout.addLayout(self._build_row(self._device_label, self._device_combo))

        self._grp_hotkey, hotkey_layout = self._create_group(layout)
        self._hotkey_mode_label = QLabel(self)
        self._rb_global = QRadioButton(self)
        self._rb_local = QRadioButton(self)
        self._rb_global.toggled.connect(self._on_hotkey_mode_changed)
        self._rb_local.toggled.connect(self._on_hotkey_mode_changed)
        mode_row = QHBoxLayout()
        mode_row.addWidget(self._hotkey_mode_label)
        mode_row.addWidget(self._rb_global)
        mode_row.addWidget(self._rb_local)
        mode_row.addStretch(1)
        hotkey_layout.addLayout(mode_row)

        for key in [
            "stop_all",
            "bgm_play_pause",
            "bgm_vol_up",
            "bgm_vol_down",
            "toggle_hotkey_mode",
            "toggle_window",
            "toggle_floating",
        ]:
            hotkey_layout.addWidget(self._make_hotkey_row(key))

        self._grp_lang, lang_layout = self._create_group(layout)
        self._lang_label = QLabel(self)
        self._lang_combo = QComboBox(self)
        for code, name in SUPPORTED_LANGUAGES.items():
            self._lang_combo.addItem(name, code)
        self._lang_combo.currentIndexChanged.connect(self._emit_language_changed)
        lang_layout.addLayout(self._build_row(self._lang_label, self._lang_combo))

        self._grp_floating, floating_layout = self._create_group(layout)
        self._floating_cb = QCheckBox(self)
        self._floating_cb.toggled.connect(self._on_floating_toggled)
        floating_layout.addWidget(self._floating_cb)

        self._grp_backup, backup_layout = self._create_group(layout)
        self._backup_hint = QLabel(self)
        self._backup_hint.setWordWrap(True)
        backup_layout.addWidget(self._backup_hint)

        backup_buttons = QHBoxLayout()
        self._backup_export_btn = QPushButton(self)
        self._backup_export_btn.clicked.connect(self._on_backup_export)
        self._backup_import_btn = QPushButton(self)
        self._backup_import_btn.clicked.connect(self._on_backup_import)
        backup_buttons.addWidget(self._backup_export_btn)
        backup_buttons.addWidget(self._backup_import_btn)
        backup_buttons.addStretch(1)
        backup_layout.addLayout(backup_buttons)

        layout.addStretch(1)
        scroll.setWidget(inner)
        outer.addWidget(scroll)
        self._retranslate_ui()

    def _create_group(self, parent_layout: QVBoxLayout) -> tuple[QGroupBox, QVBoxLayout]:
        group = QGroupBox(self)
        group_layout = QVBoxLayout(group)
        group_layout.setContentsMargins(12, 10, 12, 12)
        group_layout.setSpacing(8)
        parent_layout.addWidget(group)
        return group, group_layout

    def _build_row(self, label: QLabel, widget: QWidget) -> QHBoxLayout:
        row = QHBoxLayout()
        label.setMinimumWidth(150)
        row.addWidget(label)
        row.addWidget(widget)
        row.addStretch(1)
        return row

    def _make_hotkey_row(self, key: str) -> QWidget:
        container = QWidget(self)
        layout = QHBoxLayout(container)
        layout.setContentsMargins(0, 0, 0, 0)

        name_label = QLabel(container)
        name_label.setFixedWidth(180)

        display_label = QLabel(container)
        display_label.setFixedWidth(180)
        display_label.setStyleSheet(
            "background:#1e1e30; border-radius:4px; padding:2px 8px; color:#aaaacc;"
        )

        record_btn = QPushButton(container)
        record_btn.setObjectName("RecordButton")
        record_btn.setFixedWidth(72)
        record_btn.clicked.connect(lambda _, current=key: self._on_record(current))

        clear_btn = QPushButton(container)
        clear_btn.setObjectName("ClearButton")
        clear_btn.setFixedWidth(72)
        clear_btn.clicked.connect(lambda _, current=key: self._on_clear(current))

        layout.addWidget(name_label)
        layout.addWidget(display_label)
        layout.addWidget(record_btn)
        layout.addWidget(clear_btn)
        layout.addStretch(1)

        self._hotkey_rows[key] = (name_label, display_label, record_btn, clear_btn)
        return container

    def _on_record(self, key: str) -> None:
        current_value = self._current_hotkeys().get(key, "")
        dialog = HotkeyCaptureDialog(current_value, self)
        if dialog.exec() != QDialog.DialogCode.Accepted:
            return

        new_hotkey = dialog.hotkey
        if not new_hotkey:
            return

        hotkeys = self._current_hotkeys()
        for existing_key, existing_value in hotkeys.items():
            if existing_key != key and existing_value == new_hotkey:
                result = QMessageBox.question(
                    self,
                    "快捷键冲突",
                    f"该快捷键已被「{t('settings.hotkey.' + existing_key)}」使用，是否替换？",
                    QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
                )
                if result != QMessageBox.StandardButton.Yes:
                    return
                hotkeys[existing_key] = ""

        hotkeys[key] = new_hotkey
        db.update_config({"hotkeys": hotkeys})
        if self._mw is not None:
            self._mw._refresh_hotkeys()
        self._update_hotkey_display(key, new_hotkey)

    def _on_clear(self, key: str) -> None:
        hotkeys = self._current_hotkeys()
        hotkeys[key] = ""
        db.update_config({"hotkeys": hotkeys})
        if self._mw is not None:
            self._mw._refresh_hotkeys()
        self._update_hotkey_display(key, "")

    def _update_hotkey_display(self, key: str, value: str) -> None:
        _, display_label, _, _ = self._hotkey_rows[key]
        display_label.setText(value if value else t("settings.hotkey_unset"))

    def _emit_language_changed(self) -> None:
        if self._loading:
            return
        self.language_changed.emit(str(self._lang_combo.currentData()))

    def _on_hotkey_mode_changed(self) -> None:
        if self._loading:
            return
        mode = "global" if self._rb_global.isChecked() else "local"
        db.update_config({"hotkey_mode": mode})
        hotkey_manager.switch_mode(mode)
        if self._mw is not None:
            self._mw.bottom_bar.set_hotkey_mode(mode)
            self._mw._on_hotkey_mode_changed(mode)

    def _on_device_changed(self) -> None:
        if self._loading:
            return
        device = self._device_combo.currentData()
        target = "default" if device is None else device
        db.set_output_device(target)
        audio_engine.set_output_device(target)
        if self._mw is not None:
            self._mw._refresh_devices()

    def _on_floating_toggled(self, checked: bool) -> None:
        if self._loading:
            return
        self.floating_visibility_changed.emit(checked)

    def _on_backup_export(self) -> None:
        if self._mw is not None and hasattr(self._mw, "backup_page"):
            self._mw.backup_page._on_export()

    def _on_backup_import(self) -> None:
        if self._mw is not None and hasattr(self._mw, "backup_page"):
            self._mw.backup_page._on_import()

    def _populate_devices(self) -> None:
        current = db.config().get("output_device", "default")
        devices = audio_engine.list_output_devices()
        self._device_combo.blockSignals(True)
        self._device_combo.clear()
        self._device_combo.addItem(t("bottom.system_default"), None)
        for device in devices:
            self._device_combo.addItem(str(device["name"]), device["index"])
        index = self._device_combo.findData(None if current == "default" else current)
        if index < 0:
            index = 0
        self._device_combo.setCurrentIndex(index)
        self._device_combo.blockSignals(False)

    def _current_hotkeys(self) -> dict[str, str]:
        config = db.config()
        current = dict(config.get("hotkeys", {}))
        defaults = {
            "stop_all": "",
            "bgm_play_pause": "",
            "bgm_vol_up": "",
            "bgm_vol_down": "",
            "toggle_hotkey_mode": "",
            "toggle_window": "",
            "toggle_floating": "",
        }
        defaults.update({key: str(value) for key, value in current.items()})
        return defaults

    def load_from_config(self) -> None:
        self.refresh()

    def refresh(self) -> None:
        self._loading = True
        config = db.config()
        self._populate_devices()

        language = config.get("language", "zh")
        language_index = self._lang_combo.findData(language)
        if language_index >= 0:
            self._lang_combo.setCurrentIndex(language_index)

        mode = str(config.get("hotkey_mode", "global"))
        self._rb_global.setChecked(mode == "global")
        self._rb_local.setChecked(mode != "global")

        hotkeys = self._current_hotkeys()
        for key in self._hotkey_rows:
            self._update_hotkey_display(key, hotkeys.get(key, ""))

        floating = dict(config.get("floating_window", {}))
        self._floating_cb.setChecked(bool(floating.get("visible", False)))
        self._loading = False
        self._retranslate_ui()

    def _retranslate_ui(self, *_args) -> None:
        self._title.setText(t("settings.title"))

        self._grp_audio.setTitle(t("settings.section.device"))
        self._device_label.setText(t("bottom.output_device"))

        self._grp_hotkey.setTitle(t("settings.section.func_hotkeys"))
        self._hotkey_mode_label.setText(t("settings.hotkey_mode"))
        self._rb_global.setText(t("settings.hotkey_global"))
        self._rb_local.setText(t("settings.hotkey_local"))

        self._grp_lang.setTitle(t("settings.language"))
        self._lang_label.setText(t("settings.language"))

        self._grp_floating.setTitle(t("settings.section.floating"))
        self._floating_cb.setText(t("settings.show_floating"))

        self._grp_backup.setTitle(t("nav.backup"))
        self._backup_hint.setText(t("backup.desc"))
        self._backup_export_btn.setText(t("backup.export_button"))
        self._backup_import_btn.setText(t("backup.import_button"))

        for key, (name_label, display_label, record_btn, clear_btn) in self._hotkey_rows.items():
            name_label.setText(t(f"settings.hotkey.{key}"))
            record_btn.setText(t("settings.record"))
            clear_btn.setText(t("settings.clear"))
            if display_label.text() in {"", "未设置", "Not set"}:
                display_label.setText(t("settings.hotkey_unset"))

        self._populate_devices()
