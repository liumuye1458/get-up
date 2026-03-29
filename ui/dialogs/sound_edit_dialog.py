from __future__ import annotations

import os
from pathlib import Path

from PyQt6.QtCore import Qt, QUrl
from PyQt6.QtGui import QDesktopServices
from PyQt6.QtWidgets import (
    QCheckBox,
    QComboBox,
    QDialog,
    QDialogButtonBox,
    QDoubleSpinBox,
    QFormLayout,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QMessageBox,
    QPushButton,
    QSlider,
    QTabWidget,
    QVBoxLayout,
    QWidget,
)

from core.audio_engine import audio_engine
from core.hotkey_conflict import check_hotkey_conflict
from core.i18n_manager import t
from models.db import db
from models.sound_effect import SoundEffect
from ui.dialogs.hotkey_capture_dialog import HotkeyCaptureDialog
from ui.widgets.color_picker import ColorPicker
from ui.widgets.toggle_switch import ToggleSwitch
from ui.widgets.waveform_widget import WaveformWidget
from utils.audio_utils import read_audio_duration


class SoundEditDialog(QDialog):
    def __init__(self, sound: SoundEffect, initial_tab: int = 0, parent=None) -> None:
        super().__init__(parent)
        self._sound = SoundEffect.from_dict(sound.to_dict())
        self._preview_hotkey = self._sound.hotkey
        self._duration = read_audio_duration(self._sound.library_path)

        self.setModal(True)
        self.setFixedSize(580, 460)
        self.setWindowTitle(f"{t('card.edit')} - {self._sound.name}")

        root = QVBoxLayout(self)
        root.setContentsMargins(16, 16, 16, 16)
        root.setSpacing(12)

        self.tabs = QTabWidget(self)
        self.tabs.addTab(self._build_basic_tab(), t("edit.tab.basic"))
        self.tabs.addTab(self._build_hotkey_tab(), t("edit.tab.hotkey"))
        self.tabs.addTab(self._build_clip_tab(), t("edit.tab.clip"))
        self.tabs.addTab(self._build_personal_tab(), t("edit.tab.personal"))
        self.tabs.setCurrentIndex(max(0, min(initial_tab, 3)))
        root.addWidget(self.tabs, 1)

        buttons = QDialogButtonBox(
            QDialogButtonBox.StandardButton.Save | QDialogButtonBox.StandardButton.Cancel,
            Qt.Orientation.Horizontal,
            self,
        )
        buttons.accepted.connect(self._save)
        buttons.rejected.connect(self.reject)
        root.addWidget(buttons)

        self._load_values()

    def _build_basic_tab(self) -> QWidget:
        tab = QWidget(self)
        layout = QFormLayout(tab)
        layout.setSpacing(12)

        self.name_input = QLineEdit(tab)
        self.color_picker = ColorPicker(tab)
        self.fade_toggle = ToggleSwitch(tab)
        self.fade_toggle.toggled.connect(self._update_fade_enabled)

        self.fade_duration = QDoubleSpinBox(tab)
        self.fade_duration.setRange(0.1, 5.0)
        self.fade_duration.setSingleStep(0.1)
        self.fade_duration.setSuffix(" s")

        self._path_display = QLineEdit(tab)
        self._path_display.setReadOnly(True)
        self._path_display.setMinimumWidth(100)
        self._path_display.setMaximumWidth(300)
        self._path_display.setStyleSheet("color:#888;")

        self._open_dir_button = QPushButton(t("common.open_folder"), tab)
        self._open_dir_button.setMinimumWidth(80)
        self._open_dir_button.setFixedWidth(80)
        self._open_dir_button.clicked.connect(self._open_file_dir)

        path_row = QHBoxLayout()
        path_row.addWidget(self._path_display, 1)
        path_row.addWidget(self._open_dir_button, 0)

        self._tag_combo = QComboBox(tab)
        self._tag_combo.addItem(t("common.no_tag"), userData=0)
        for tag in db.all_tags():
            self._tag_combo.addItem(tag.name, userData=tag.id)

        layout.addRow(t("sound_edit.name"), self.name_input)
        layout.addRow(t("sound_edit.color"), self.color_picker)
        layout.addRow(t("sound_edit.fade_in"), self.fade_toggle)
        layout.addRow(t("common.fade_in_duration"), self.fade_duration)
        layout.addRow(t("common.file_path"), path_row)
        layout.addRow(t("common.assigned_tag"), self._tag_combo)
        return tab

    def _build_hotkey_tab(self) -> QWidget:
        tab = QWidget(self)
        layout = QVBoxLayout(tab)
        layout.setSpacing(16)

        self.hotkey_label = QLabel(tab)
        self.hotkey_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.hotkey_label.setStyleSheet("font-size: 28px; font-weight: 700;")

        buttons = QHBoxLayout()
        self.record_hotkey_button = QPushButton(t("sound_edit.record_new_hotkey"), tab)
        self.record_hotkey_button.clicked.connect(self._record_hotkey)
        self.clear_hotkey_button = QPushButton(t("sound_edit.clear_hotkey"), tab)
        self.clear_hotkey_button.clicked.connect(self._clear_hotkey)
        buttons.addWidget(self.record_hotkey_button)
        buttons.addWidget(self.clear_hotkey_button)

        self.hotkey_hint = QLabel(t("sound_edit.hotkey_hint"), tab)
        self.hotkey_hint.setStyleSheet("color: #7f8aa3;")
        self.hotkey_hint.setAlignment(Qt.AlignmentFlag.AlignCenter)

        layout.addStretch(1)
        layout.addWidget(self.hotkey_label)
        layout.addLayout(buttons)
        layout.addWidget(self.hotkey_hint)
        layout.addStretch(1)
        return tab

    def _build_clip_tab(self) -> QWidget:
        tab = QWidget(self)
        layout = QVBoxLayout(tab)
        layout.setSpacing(12)

        info_row = QHBoxLayout()
        self.total_duration_label = QLabel(tab)
        self.clipped_duration_label = QLabel(tab)
        info_row.addWidget(self.total_duration_label)
        info_row.addStretch(1)
        info_row.addWidget(self.clipped_duration_label)

        self.waveform = WaveformWidget(tab)
        self.waveform.setFixedHeight(140)
        self.waveform.trim_changed.connect(self._on_waveform_trim_changed)

        time_row = QHBoxLayout()
        self.trim_start_spin = QDoubleSpinBox(tab)
        self.trim_start_spin.setRange(0.0, max(0.0, self._duration))
        self.trim_start_spin.setSingleStep(0.01)
        self.trim_start_spin.setSuffix(" s")
        self.trim_start_spin.valueChanged.connect(self._on_spin_trim_changed)

        self.trim_end_spin = QDoubleSpinBox(tab)
        self.trim_end_spin.setRange(0.01, max(0.01, self._duration))
        self.trim_end_spin.setSingleStep(0.01)
        self.trim_end_spin.setSuffix(" s")
        self.trim_end_spin.valueChanged.connect(self._on_spin_trim_changed)

        time_row.addWidget(QLabel(t("common.start_time"), tab))
        time_row.addWidget(self.trim_start_spin)
        time_row.addWidget(QLabel(t("common.end_time"), tab))
        time_row.addWidget(self.trim_end_spin)

        action_row = QHBoxLayout()
        self.preview_button = QPushButton(t("sound_edit.preview_current_clip"), tab)
        self.preview_button.clicked.connect(self._preview_clip)
        self.stop_preview_button = QPushButton(t("sound_edit.stop_preview"), tab)
        self.stop_preview_button.clicked.connect(audio_engine.stop_all)
        self.clear_trim_button = QPushButton(t("common.clear_clip"), tab)
        self.clear_trim_button.clicked.connect(self._clear_trim)
        action_row.addWidget(self.preview_button)
        action_row.addWidget(self.stop_preview_button)
        action_row.addWidget(self.clear_trim_button)

        hint = QLabel(t("sound_edit.clip_hint"), tab)
        hint.setStyleSheet("color: #7f8aa3;")

        layout.addLayout(info_row)
        layout.addWidget(self.waveform)
        layout.addLayout(time_row)
        layout.addLayout(action_row)
        layout.addWidget(hint)
        layout.addStretch(1)
        return tab

    def _build_personal_tab(self) -> QWidget:
        tab = QWidget(self)
        layout = QVBoxLayout(tab)
        layout.setSpacing(16)

        self.volume_slider = QSlider(Qt.Orientation.Horizontal, tab)
        self.volume_slider.setRange(0, 100)
        self.volume_value = QLabel(tab)
        self.volume_slider.valueChanged.connect(lambda value: self.volume_value.setText(f"{value}%"))

        self.speed_slider = QSlider(Qt.Orientation.Horizontal, tab)
        self.speed_slider.setRange(5, 20)
        self.speed_value = QLabel(tab)
        self.speed_slider.valueChanged.connect(lambda value: self.speed_value.setText(f"{value / 10:.1f}x"))

        for title, widget, label in [
            (t("common.volume"), self.volume_slider, self.volume_value),
            (t("common.speed"), self.speed_slider, self.speed_value),
        ]:
            row = QHBoxLayout()
            row.addWidget(QLabel(title, tab))
            row.addWidget(widget, 1)
            row.addWidget(label)
            layout.addLayout(row)

        self.loop_cb = QCheckBox(t("common.loop_playback"), tab)
        layout.addWidget(self.loop_cb)
        layout.addStretch(1)
        return tab

    def _load_values(self) -> None:
        self.name_input.setText(self._sound.name)
        self.color_picker.set_color(self._sound.color)
        self.fade_toggle.setChecked(self._sound.fade_in)
        self.fade_duration.setValue(self._sound.fade_in_duration)
        self._update_fade_enabled(self._sound.fade_in)
        self._path_display.setText(str(Path(self._sound.library_path).resolve()))

        current_tags = self._sound.tags or []
        if current_tags:
            combo_index = self._tag_combo.findData(current_tags[0])
            if combo_index >= 0:
                self._tag_combo.setCurrentIndex(combo_index)

        self._set_hotkey_label(self._preview_hotkey)

        self.waveform.load_audio(self._sound.library_path)
        trim_end = self._sound.trim_end if self._sound.trim_end is not None else self._duration
        self.trim_start_spin.setRange(0.0, max(0.0, self._duration - 0.01))
        self.trim_end_spin.setRange(0.01, max(0.01, self._duration))
        self.trim_start_spin.setValue(self._sound.trim_start)
        self.trim_end_spin.setValue(trim_end)
        self.waveform.set_trim(self._sound.trim_start, trim_end)
        self._update_duration_labels()

        self.volume_slider.setValue(self._sound.volume)
        self.speed_slider.setValue(int(round(self._sound.speed * 10)))
        self.loop_cb.setChecked(self._sound.loop)

    def _set_hotkey_label(self, value: str) -> None:
        self.hotkey_label.setText(value or t("settings.hotkey_unset"))

    def _update_fade_enabled(self, enabled: bool) -> None:
        self.fade_duration.setEnabled(enabled)

    def _record_hotkey(self) -> None:
        dialog = HotkeyCaptureDialog(self._preview_hotkey, self)
        if dialog.exec():
            self._preview_hotkey = dialog.hotkey
            self._set_hotkey_label(self._preview_hotkey)

    def _clear_hotkey(self) -> None:
        self._preview_hotkey = ""
        self._set_hotkey_label("")

    def _on_waveform_trim_changed(self, start: float, end: float) -> None:
        self.trim_start_spin.blockSignals(True)
        self.trim_end_spin.blockSignals(True)
        self.trim_start_spin.setValue(start)
        self.trim_end_spin.setValue(end)
        self.trim_start_spin.blockSignals(False)
        self.trim_end_spin.blockSignals(False)
        self._update_duration_labels()

    def _on_spin_trim_changed(self) -> None:
        start = self.trim_start_spin.value()
        end = max(start + 0.01, self.trim_end_spin.value())
        self.trim_end_spin.blockSignals(True)
        self.trim_end_spin.setValue(end)
        self.trim_end_spin.blockSignals(False)
        self.waveform.set_trim(start, end)
        self._update_duration_labels()

    def _update_duration_labels(self) -> None:
        clipped = max(0.0, self.trim_end_spin.value() - self.trim_start_spin.value())
        self.total_duration_label.setText(t("common.total_duration", duration=f"{self._duration:.2f}s"))
        self.clipped_duration_label.setText(t("common.clipped_duration", duration=f"{clipped:.2f}s"))

    def _preview_clip(self) -> None:
        preview = SoundEffect.from_dict(self._sound.to_dict())
        preview.trim_start = self.trim_start_spin.value()
        preview.trim_end = self.trim_end_spin.value()
        preview.volume = self.volume_slider.value()
        preview.speed = self.speed_slider.value() / 10.0
        preview.fade_in = self.fade_toggle.isChecked()
        preview.fade_in_duration = self.fade_duration.value()
        preview.enabled = True
        preview.loop = self.loop_cb.isChecked()
        audio_engine.play_sound(preview)

    def _open_file_dir(self) -> None:
        path = str(Path(self._sound.library_path).resolve())
        dir_path = os.path.dirname(path)
        QDesktopServices.openUrl(QUrl.fromLocalFile(dir_path))

    def _clear_trim(self) -> None:
        self.trim_start_spin.setValue(0.0)
        self.trim_end_spin.setValue(self._duration)
        self.waveform.clear_trim()
        self._update_duration_labels()

    def _save(self) -> None:
        if self._preview_hotkey:
            conflict = check_hotkey_conflict(
                self._preview_hotkey,
                exclude_type="sound",
                exclude_id=self._sound.id,
            )
            if conflict is not None:
                conflict_name = conflict["name"]
                if conflict["type"] == "system":
                    conflict_name = t(conflict_name)
                QMessageBox.warning(
                    self,
                    t("hotkey_conflict_title"),
                    t(
                        f"hotkey_conflict_{conflict['type']}",
                        hotkey=self._preview_hotkey,
                        name=conflict_name,
                    ),
                )
                return

        self._sound.name = self.name_input.text().strip()[:50] or self._sound.name
        self._sound.color = self.color_picker.color()
        self._sound.fade_in = self.fade_toggle.isChecked()
        self._sound.fade_in_duration = self.fade_duration.value()
        self._sound.hotkey = self._preview_hotkey
        self._sound.trim_start = self.trim_start_spin.value()
        trim_end = self.trim_end_spin.value()
        self._sound.trim_end = None if abs(trim_end - self._duration) < 0.01 else trim_end
        self._sound.volume = self.volume_slider.value()
        self._sound.speed = self.speed_slider.value() / 10.0
        self._sound.loop = self.loop_cb.isChecked()
        self._sound.enabled = True

        db.update_sound(self._sound)

        selected_tag_id = self._tag_combo.currentData()
        if selected_tag_id:
            db.set_sound_tags(self._sound.id, [str(selected_tag_id)])
        else:
            db.set_sound_tags(self._sound.id, [])
        self.accept()
