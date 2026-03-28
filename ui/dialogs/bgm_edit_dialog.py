from __future__ import annotations

from PyQt6.QtCore import Qt
from PyQt6.QtWidgets import (
    QDialog,
    QDialogButtonBox,
    QDoubleSpinBox,
    QFormLayout,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QPushButton,
    QSlider,
    QTabWidget,
    QVBoxLayout,
    QWidget,
)

from core.audio_engine import audio_engine
from models.bgm import BackgroundMusic
from models.db import db
from models.sound_effect import SoundEffect
from ui.dialogs.hotkey_capture_dialog import HotkeyCaptureDialog
from ui.widgets.color_picker import ColorPicker
from ui.widgets.toggle_switch import ToggleSwitch
from ui.widgets.waveform_widget import WaveformWidget
from utils.audio_utils import read_audio_duration


class BgmEditDialog(QDialog):
    def __init__(self, bgm: BackgroundMusic, initial_tab: int = 0, parent=None) -> None:
        super().__init__(parent)
        self.bgm = BackgroundMusic.from_dict(bgm.to_dict())
        self._preview_hotkey = self.bgm.hotkey
        self._duration = read_audio_duration(self.bgm.library_path)

        self.setModal(True)
        self.setFixedSize(580, 460)
        self.setWindowTitle(f"编辑 BGM - {self.bgm.name}")

        root = QVBoxLayout(self)
        root.setContentsMargins(16, 16, 16, 16)
        root.setSpacing(12)

        self.tabs = QTabWidget(self)
        self.tabs.addTab(self._build_basic_tab(), "基本设置")
        self.tabs.addTab(self._build_hotkey_tab(), "快捷键")
        self.tabs.addTab(self._build_clip_tab(), "音效剪辑")
        self.tabs.addTab(self._build_personal_tab(), "个性化")
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

        layout.addRow("名称", self.name_input)
        layout.addRow("颜色", self.color_picker)
        layout.addRow("淡入", self.fade_toggle)
        layout.addRow("淡入时长", self.fade_duration)
        return tab

    def _build_hotkey_tab(self) -> QWidget:
        tab = QWidget(self)
        layout = QVBoxLayout(tab)
        layout.setSpacing(16)

        self.hotkey_label = QLabel(tab)
        self.hotkey_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.hotkey_label.setStyleSheet("font-size: 28px; font-weight: 700;")

        buttons = QHBoxLayout()
        self.record_hotkey_button = QPushButton("录制", tab)
        self.record_hotkey_button.clicked.connect(self._record_hotkey)
        self.clear_hotkey_button = QPushButton("清除", tab)
        self.clear_hotkey_button.clicked.connect(self._clear_hotkey)
        buttons.addWidget(self.record_hotkey_button)
        buttons.addWidget(self.clear_hotkey_button)

        self.hotkey_hint = QLabel("按下快捷键进行录制，ESC 取消", tab)
        self.hotkey_hint.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.hotkey_hint.setStyleSheet("color: #7f8aa3;")

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
        time_row.addWidget(QLabel("开始", tab))
        time_row.addWidget(self.trim_start_spin)
        time_row.addWidget(QLabel("结束", tab))
        time_row.addWidget(self.trim_end_spin)

        action_row = QHBoxLayout()
        self.preview_button = QPushButton("试听片段", tab)
        self.preview_button.clicked.connect(self._preview_clip)
        self.stop_preview_button = QPushButton("停止", tab)
        self.stop_preview_button.clicked.connect(audio_engine.stop_all)
        self.clear_trim_button = QPushButton("清除剪辑", tab)
        self.clear_trim_button.clicked.connect(self._clear_trim)
        action_row.addWidget(self.preview_button)
        action_row.addWidget(self.stop_preview_button)
        action_row.addWidget(self.clear_trim_button)

        hint = QLabel("拖动波形两侧的标记，调整 BGM 剪辑范围", tab)
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
        self.speed_slider.valueChanged.connect(
            lambda value: self.speed_value.setText(f"{value / 10:.1f}x")
        )

        self.loop_toggle = ToggleSwitch(tab)

        for title, widget, label in [
            ("音量", self.volume_slider, self.volume_value),
            ("播放速度", self.speed_slider, self.speed_value),
        ]:
            row = QHBoxLayout()
            row.addWidget(QLabel(title, tab))
            row.addWidget(widget, 1)
            row.addWidget(label)
            layout.addLayout(row)

        loop_row = QHBoxLayout()
        loop_row.addWidget(QLabel("循环播放", tab))
        loop_row.addWidget(self.loop_toggle)
        loop_row.addStretch(1)
        layout.addLayout(loop_row)
        layout.addStretch(1)
        return tab

    def _load_values(self) -> None:
        self.name_input.setText(self.bgm.name)
        self.color_picker.set_color("#1a6b8a")
        self.fade_toggle.setChecked(self.bgm.fade_in)
        self.fade_duration.setValue(self.bgm.fade_in_duration)
        self._update_fade_enabled(self.bgm.fade_in)
        self._set_hotkey_label(self._preview_hotkey)

        self.waveform.load_audio(self.bgm.library_path)
        trim_end = self.bgm.trim_end if self.bgm.trim_end is not None else self._duration
        self.trim_start_spin.setRange(0.0, max(0.0, self._duration - 0.01))
        self.trim_end_spin.setRange(0.01, max(0.01, self._duration))
        self.trim_start_spin.setValue(self.bgm.trim_start)
        self.trim_end_spin.setValue(trim_end)
        self.waveform.set_trim(self.bgm.trim_start, trim_end)
        self._update_duration_labels()

        self.volume_slider.setValue(self.bgm.volume)
        self.speed_slider.setValue(int(round(self.bgm.speed * 10)))
        self.loop_toggle.setChecked(self.bgm.loop)

    def _set_hotkey_label(self, value: str) -> None:
        self.hotkey_label.setText(value or "未设置")

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
        self.total_duration_label.setText(f"总时长：{self._duration:.2f}s")
        self.clipped_duration_label.setText(f"剪辑后：{clipped:.2f}s")

    def _preview_clip(self) -> None:
        preview = SoundEffect.create(
            name=self.bgm.name,
            original_filename=self.bgm.original_filename,
            library_path=self.bgm.library_path,
            color="#1a6b8a",
            sort_order=0,
        )
        preview.trim_start = self.trim_start_spin.value()
        preview.trim_end = self.trim_end_spin.value()
        preview.volume = self.volume_slider.value()
        preview.speed = self.speed_slider.value() / 10.0
        preview.fade_in = self.fade_toggle.isChecked()
        preview.fade_in_duration = self.fade_duration.value()
        preview.enabled = True
        audio_engine.play_sound(preview)

    def _clear_trim(self) -> None:
        self.trim_start_spin.setValue(0.0)
        self.trim_end_spin.setValue(self._duration)
        self.waveform.clear_trim()
        self._update_duration_labels()

    def _save(self) -> None:
        self.bgm.name = self.name_input.text().strip()[:50] or self.bgm.name
        self.bgm.fade_in = self.fade_toggle.isChecked()
        self.bgm.fade_in_duration = self.fade_duration.value()
        self.bgm.hotkey = self._preview_hotkey
        self.bgm.trim_start = self.trim_start_spin.value()
        trim_end = self.trim_end_spin.value()
        self.bgm.trim_end = None if abs(trim_end - self._duration) < 0.01 else trim_end
        self.bgm.volume = self.volume_slider.value()
        self.bgm.speed = self.speed_slider.value() / 10.0
        self.bgm.loop = self.loop_toggle.isChecked()
        db.update_bgm(self.bgm)
        self.accept()
