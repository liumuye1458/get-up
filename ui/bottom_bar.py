"""
Bottom control bar without emoji glyphs.
"""
from __future__ import annotations

from PyQt6.QtCore import QSize, Qt, pyqtSignal
from PyQt6.QtGui import QColor, QFont, QIcon, QPainter, QPen, QPixmap
from PyQt6.QtWidgets import QComboBox, QFrame, QHBoxLayout, QLabel, QPushButton, QSlider, QWidget

from core.audio_engine import BGMPlayer
from core.hotkey_manager import hotkey_manager
from core.i18n_manager import I18nManager
from models.bgm import BackgroundMusic
from utils.audio_utils import read_audio_duration


def _make_icon(text: str, color: str, size: int = 20) -> QIcon:
    pixmap = QPixmap(QSize(size, size))
    pixmap.fill(QColor("transparent"))
    painter = QPainter(pixmap)
    painter.setRenderHint(QPainter.RenderHint.Antialiasing)
    painter.setPen(QPen(QColor(color)))
    painter.setFont(QFont("Segoe UI Symbol", max(9, int(size * 0.55)), QFont.Weight.Bold))
    painter.drawText(pixmap.rect(), Qt.AlignmentFlag.AlignCenter, text)
    painter.end()
    return QIcon(pixmap)


def _sep() -> QFrame:
    frame = QFrame()
    frame.setFixedSize(1, 22)
    frame.setStyleSheet("background: #2e2e46;")
    return frame


class BottomBar(QWidget):
    output_device_changed = pyqtSignal(object)
    device_changed = pyqtSignal(int)
    stop_all_requested = pyqtSignal()
    hotkeys_enabled_changed = pyqtSignal(bool)
    hotkey_toggled = pyqtSignal(bool)
    bgm_position_changed = pyqtSignal(float, float)
    play_clicked = pyqtSignal()
    volume_changed = pyqtSignal(int)
    loop_toggled = pyqtSignal(bool)

    def __init__(self, parent=None) -> None:
        super().__init__(parent)
        self._current_bgm: BackgroundMusic | None = None
        self._is_playing = False
        self._device_label: QLabel | None = None
        self._vol_icon: QLabel | None = None
        self._build_ui()
        self.bgm_position_changed.connect(self._update_time)
        BGMPlayer.instance().position_cb = self._forward_position

    def _build_ui(self) -> None:
        self.setFixedHeight(48)
        self.setStyleSheet(
            """
            BottomBar {
                background: #1a1a2e;
                border-top: 1px solid #2a2a3e;
            }
            """
        )

        layout = QHBoxLayout(self)
        layout.setContentsMargins(20, 0, 20, 10)
        layout.setSpacing(0)

        self._device_label = QLabel("输出" if I18nManager.current_language() == "zh" else "Output")
        self._device_label.setStyleSheet("color: #666; font-size: 12px; border: none;")
        layout.addWidget(self._device_label, 0, Qt.AlignmentFlag.AlignVCenter)
        layout.addSpacing(8)

        self._device_combo = QComboBox()
        self._device_combo.setFixedSize(160, 28)
        self._device_combo.setStyleSheet(
            """
            QComboBox {
                background: #252540; border: 1px solid #333360;
                border-radius: 4px; color: #ccc; font-size: 12px;
                padding: 3px 8px;
            }
            QComboBox:hover { border-color: #4a4a80; }
            QComboBox::drop-down { border: none; }
            QComboBox QAbstractItemView {
                background: #252540; color: #ccc;
                selection-background-color: #1565c0;
            }
            """
        )
        self._device_combo.currentIndexChanged.connect(self._emit_output_change)
        layout.addWidget(self._device_combo, 0, Qt.AlignmentFlag.AlignVCenter)

        layout.addSpacing(16)
        layout.addWidget(_sep(), 0, Qt.AlignmentFlag.AlignVCenter)
        layout.addSpacing(16)

        self._hotkey_btn = QPushButton()
        self._hotkey_btn.setFixedSize(34, 28)
        self._hotkey_btn.setCheckable(True)
        self._hotkey_btn.setChecked(True)
        self._hotkey_btn.setFocusPolicy(Qt.FocusPolicy.NoFocus)
        self._update_toggle_btn(self._hotkey_btn, True, "\u2328")
        self._hotkey_btn.toggled.connect(lambda checked: self._update_toggle_btn(self._hotkey_btn, checked, "\u2328"))
        self._hotkey_btn.toggled.connect(self._on_hotkey_toggled)
        layout.addWidget(self._hotkey_btn, 0, Qt.AlignmentFlag.AlignVCenter)

        layout.addSpacing(16)
        layout.addWidget(_sep(), 0, Qt.AlignmentFlag.AlignVCenter)
        layout.addSpacing(16)

        self._time_label = QLabel("00:00 / 00:00")
        self._time_label.setStyleSheet("color: #888; font-size: 12px; border: none;")
        self._time_label.setFixedWidth(96)
        self._time_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        layout.addWidget(self._time_label, 0, Qt.AlignmentFlag.AlignVCenter)
        layout.addSpacing(8)

        self._play_btn = QPushButton()
        self._play_btn.setFixedSize(36, 28)
        self._play_btn.setFocusPolicy(Qt.FocusPolicy.NoFocus)
        self._update_play_btn()
        self._play_btn.clicked.connect(self._on_play_pause)
        layout.addWidget(self._play_btn, 0, Qt.AlignmentFlag.AlignVCenter)

        layout.addSpacing(16)
        layout.addWidget(_sep(), 0, Qt.AlignmentFlag.AlignVCenter)
        layout.addSpacing(16)

        self._vol_icon = QLabel()
        self._vol_icon.setPixmap(_make_icon("\u266A", "#666666", 18).pixmap(18, 18))
        self._vol_icon.setFixedSize(18, 18)
        self._vol_icon.setStyleSheet("border: none;")
        layout.addWidget(self._vol_icon, 0, Qt.AlignmentFlag.AlignVCenter)
        layout.addSpacing(8)

        self._vol_slider = QSlider(Qt.Orientation.Horizontal)
        self._vol_slider.setRange(0, 100)
        self._vol_slider.setValue(70)
        self._vol_slider.setFixedWidth(110)
        self._vol_slider.setStyleSheet(
            """
            QSlider::groove:horizontal {
                height: 4px; background: #333; border-radius: 2px;
            }
            QSlider::handle:horizontal {
                width: 12px; height: 12px; margin: -4px 0;
                background: #1565c0; border-radius: 6px;
            }
            QSlider::sub-page:horizontal {
                background: #1565c0; border-radius: 2px;
            }
            """
        )
        self._vol_slider.valueChanged.connect(self._update_vol_num)
        self._vol_slider.valueChanged.connect(self._on_volume_changed)
        layout.addWidget(self._vol_slider, 0, Qt.AlignmentFlag.AlignVCenter)
        layout.addSpacing(8)

        self._vol_num = QLabel("70")
        self._vol_num.setStyleSheet("color: #888; font-size: 12px; border: none;")
        self._vol_num.setFixedWidth(26)
        self._vol_num.setAlignment(Qt.AlignmentFlag.AlignRight | Qt.AlignmentFlag.AlignVCenter)
        layout.addWidget(self._vol_num, 0, Qt.AlignmentFlag.AlignVCenter)

        layout.addSpacing(16)
        layout.addWidget(_sep(), 0, Qt.AlignmentFlag.AlignVCenter)
        layout.addSpacing(16)

        self._loop_btn = QPushButton()
        self._loop_btn.setFixedSize(34, 28)
        self._loop_btn.setCheckable(True)
        self._loop_btn.setChecked(True)
        self._loop_btn.setFocusPolicy(Qt.FocusPolicy.NoFocus)
        self._update_toggle_btn(self._loop_btn, True, "\u21BB")
        self._loop_btn.toggled.connect(lambda checked: self._update_toggle_btn(self._loop_btn, checked, "\u21BB"))
        self._loop_btn.toggled.connect(self._on_loop_toggled)
        layout.addWidget(self._loop_btn, 0, Qt.AlignmentFlag.AlignVCenter)

        layout.addStretch()
        self._retranslate_ui()

    def _update_toggle_btn(self, btn: QPushButton, checked: bool, text: str) -> None:
        bg, fg = ("#1565c0", "#ffffff") if checked else ("#2a2a3a", "#555555")
        btn.setIcon(_make_icon(text, fg, 20))
        btn.setIconSize(QSize(20, 20))
        btn.setText("")
        btn.setStyleSheet(
            f"QPushButton {{ background:{bg}; border:none; border-radius:4px; }}"
            f"QPushButton:hover {{ background:{bg}; border:none; border-radius:4px; }}"
        )

    def _update_play_btn(self) -> None:
        label = "\u23F8" if self._is_playing else "\u25B6"
        self._play_btn.setIcon(_make_icon(label, "#ffffff", 18))
        self._play_btn.setIconSize(QSize(18, 18))
        self._play_btn.setText("")
        self._play_btn.setStyleSheet(
            "QPushButton { background:#1565c0; border:none; border-radius:4px; }"
            "QPushButton:hover { background:#1976d2; border:none; border-radius:4px; }"
        )

    def _emit_output_change(self) -> None:
        self.output_device_changed.emit(self._device_combo.currentData())
        self.device_changed.emit(self._device_combo.currentIndex())

    def _forward_position(self, current: float, total: float) -> None:
        self.bgm_position_changed.emit(current, total)

    def _update_time(self, current: float, total: float) -> None:
        def fmt(seconds: float) -> str:
            return f"{int(seconds // 60):02d}:{int(seconds % 60):02d}"

        self._time_label.setText(f"{fmt(current)} / {fmt(total)}")

    def _duration_of(self, bgm: BackgroundMusic) -> float:
        try:
            return read_audio_duration(bgm.library_path)
        except Exception:
            return 0.0

    def _on_hotkey_toggled(self, checked: bool) -> None:
        hotkey_manager.set_enabled(checked)
        self.hotkeys_enabled_changed.emit(checked)
        self.hotkey_toggled.emit(checked)

    def _on_play_pause(self) -> None:
        if self._current_bgm is None:
            self._is_playing = not self._is_playing
            self._update_play_btn()
            self.play_clicked.emit()
            return

        player = BGMPlayer.instance()
        if player.is_playing:
            player.pause()
            self.set_playing(False)
        elif player.is_paused:
            player.resume()
            self.set_playing(True)
        else:
            player.play(self._current_bgm.library_path, self._vol_slider.value(), self._loop_btn.isChecked())
            self.set_playing(True)
        self.play_clicked.emit()

    def _update_vol_num(self, val: int) -> None:
        self._vol_num.setText(str(val))

    def _on_volume_changed(self, value: int) -> None:
        BGMPlayer.instance().set_volume(value)
        self.volume_changed.emit(value)

    def _on_loop_toggled(self, checked: bool) -> None:
        BGMPlayer.instance().set_loop(checked)
        self.loop_toggled.emit(checked)

    def set_devices(self, devices: list[dict], current_device: str | int = "default") -> None:
        self._device_combo.blockSignals(True)
        self._device_combo.clear()
        for device in devices:
            value = "default" if device["index"] == -1 else device["index"]
            self._device_combo.addItem(device["name"], value)
        target_device = "default" if current_device in {None, -1, "default"} else current_device
        index = self._device_combo.findData(target_device)
        if index < 0:
            index = 0
        self._device_combo.setCurrentIndex(index)
        self._device_combo.blockSignals(False)

    def set_time(self, current: str, total: str) -> None:
        self._time_label.setText(f"{current} / {total}")

    def set_playing(self, playing: bool) -> None:
        self._is_playing = playing
        self._update_play_btn()

    def set_volume(self, val: int) -> None:
        self._vol_slider.blockSignals(True)
        self._vol_slider.setValue(val)
        self._vol_slider.blockSignals(False)
        self._vol_num.setText(str(val))

    def set_hotkeys_enabled(self, enabled: bool) -> None:
        self._hotkey_btn.blockSignals(True)
        self._hotkey_btn.setChecked(enabled)
        self._hotkey_btn.blockSignals(False)
        self._update_toggle_btn(self._hotkey_btn, enabled, "\u2328")

    def set_hotkey_mode(self, _mode: str) -> None:
        return

    def set_current_bgm(self, bgm: BackgroundMusic | None) -> None:
        self._current_bgm = bgm
        if bgm is None:
            self._time_label.setText("00:00 / 00:00")
            self.set_playing(False)
            return
        self.set_volume(bgm.volume)
        self._loop_btn.blockSignals(True)
        self._loop_btn.setChecked(bgm.loop)
        self._loop_btn.blockSignals(False)
        self._update_toggle_btn(self._loop_btn, bgm.loop, "\u21BB")
        self._update_time(0.0, self._duration_of(bgm))
        self.set_playing(False)

    def set_bgm_state(self, *, playing: bool, paused: bool = False) -> None:
        self.set_playing(playing and not paused)

    def is_hotkey_enabled(self) -> bool:
        return self._hotkey_btn.isChecked()

    def is_loop_enabled(self) -> bool:
        return self._loop_btn.isChecked()

    def _retranslate_ui(self) -> None:
        if self._device_label is not None:
            self._device_label.setText("输出" if I18nManager.current_language() == "zh" else "Output")
        if I18nManager.current_language() == "zh":
            self._hotkey_btn.setToolTip("快捷键开关")
            self._loop_btn.setToolTip("循环播放")
            self._play_btn.setToolTip("播放 / 暂停")
        else:
            self._hotkey_btn.setToolTip("Hotkey Toggle")
            self._loop_btn.setToolTip("Loop Playback")
            self._play_btn.setToolTip("Play / Pause")
