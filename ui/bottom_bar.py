from __future__ import annotations

from PyQt6.QtCore import Qt, pyqtSignal
from PyQt6.QtWidgets import QComboBox, QFrame, QHBoxLayout, QLabel, QPushButton, QSlider, QWidget

from core.audio_engine import BGMPlayer
from core.i18n_manager import I18nManager, t
from models.bgm import BackgroundMusic
from ui.widgets.toggle_switch import ToggleSwitch
from utils.audio_utils import read_audio_duration


class BottomBar(QWidget):
    output_device_changed = pyqtSignal(object)
    stop_all_requested = pyqtSignal()
    hotkeys_enabled_changed = pyqtSignal(bool)
    bgm_position_changed = pyqtSignal(float, float)

    def __init__(self, parent=None) -> None:
        super().__init__(parent)
        self._current_bgm: BackgroundMusic | None = None
        self._loop = True

        self.setObjectName("BottomControlBar")
        self.setFixedHeight(52)

        layout = QHBoxLayout(self)
        layout.setContentsMargins(16, 8, 16, 8)
        layout.setSpacing(12)

        self.output_label = QLabel(self)
        self.output_label.setStyleSheet("color: #666677;")
        self.output_combo = QComboBox(self)
        self.output_combo.setMinimumWidth(220)
        self.output_combo.currentIndexChanged.connect(self._emit_output_change)
        layout.addWidget(self.output_label)
        layout.addWidget(self.output_combo)

        divider = QFrame(self)
        divider.setFrameShape(QFrame.Shape.VLine)
        divider.setStyleSheet("color: #333344;")
        layout.addWidget(divider)

        self.hotkey_toggle = ToggleSwitch(self)
        self.hotkey_toggle.setChecked(True)
        self.hotkey_toggle.toggled.connect(self.hotkeys_enabled_changed.emit)
        self.hotkey_label = QLabel(self)

        self._btn_stop = QPushButton("⏹", self)
        self._btn_stop.setObjectName("StopAllButton")
        self._btn_stop.clicked.connect(self.stop_all_requested.emit)

        self._btn_prev = QPushButton("⏮", self)
        self._btn_prev.setEnabled(False)

        self._btn_play = QPushButton("▶", self)
        self._btn_play.clicked.connect(self._on_play)

        self._btn_pause = QPushButton("⏸", self)
        self._btn_pause.clicked.connect(self._on_pause)

        self._btn_next = QPushButton("⏭", self)
        self._btn_next.setEnabled(False)

        for button, tooltip in [
            (self._btn_stop, t("bottom.stop_all")),
            (self._btn_prev, "上一首"),
            (self._btn_play, "播放"),
            (self._btn_pause, "暂停"),
            (self._btn_next, "下一首"),
        ]:
            button.setFixedSize(36, 30)
            button.setToolTip(tooltip)

        self.time_label = QLabel("0:00 / 0:00", self)
        self.time_label.setStyleSheet("color: #888899;")
        self.loop_button = QPushButton("Loop", self)
        self.loop_button.setFixedWidth(42)
        self.loop_button.clicked.connect(self._on_loop_toggle)
        self.volume_slider = QSlider(Qt.Orientation.Horizontal, self)
        self.volume_slider.setRange(0, 100)
        self.volume_slider.setValue(70)
        self.volume_slider.setFixedWidth(80)
        self.volume_slider.valueChanged.connect(self._on_volume_changed)
        self.vol_label = QLabel("70", self)
        self.vol_label.setStyleSheet("color: #888899; min-width: 22px;")

        layout.addWidget(self.hotkey_toggle)
        layout.addWidget(self.hotkey_label)
        layout.addWidget(self._btn_stop)
        layout.addWidget(self._btn_prev)
        layout.addWidget(self._btn_play)
        layout.addWidget(self._btn_pause)
        layout.addWidget(self._btn_next)
        layout.addWidget(self.time_label)
        layout.addWidget(self.loop_button)
        layout.addWidget(self.volume_slider)
        layout.addWidget(self.vol_label)
        layout.addStretch(1)

        self.bgm_position_changed.connect(self._update_time)
        BGMPlayer.instance().position_cb = self._forward_position
        I18nManager.events.language_changed.connect(self._retranslate_ui)
        self._set_bgm_controls_enabled(False)
        self._set_loop_style()
        self._retranslate_ui()

    def set_devices(self, devices: list[dict[str, object]], current_device: str | int) -> None:
        self.output_combo.blockSignals(True)
        self.output_combo.clear()
        self.output_combo.addItem(t("bottom.system_default"), "default")
        for device in devices:
            self.output_combo.addItem(str(device["name"]), device["index"])
        index = self.output_combo.findData(current_device)
        if index < 0:
            index = 0
        self.output_combo.setCurrentIndex(index)
        self.output_combo.blockSignals(False)

    def set_hotkeys_enabled(self, enabled: bool) -> None:
        self.hotkey_toggle.blockSignals(True)
        self.hotkey_toggle.setChecked(enabled)
        self.hotkey_toggle.blockSignals(False)
        self.hotkey_label.setText(t("bottom.hotkey_on") if enabled else t("bottom.hotkey_off"))

    def set_hotkey_mode(self, mode: str) -> None:
        self.set_hotkeys_enabled(mode == "global")

    def set_current_bgm(self, bgm: BackgroundMusic | None) -> None:
        self._current_bgm = bgm
        if bgm is None:
            self._loop = True
            self.volume_slider.blockSignals(True)
            self.volume_slider.setValue(70)
            self.volume_slider.blockSignals(False)
            self.vol_label.setText("70")
            self.time_label.setText("0:00 / 0:00")
            self._set_loop_style()
            self._set_bgm_controls_enabled(False)
            return

        self._loop = bgm.loop
        self.volume_slider.blockSignals(True)
        self.volume_slider.setValue(bgm.volume)
        self.volume_slider.blockSignals(False)
        self.vol_label.setText(str(bgm.volume))
        self._update_time(0.0, self._duration_of(bgm))
        self._set_loop_style()
        self._sync_transport_buttons()
        self._set_bgm_controls_enabled(True)

    def set_bgm_state(self, *, playing: bool, paused: bool = False) -> None:
        if self._current_bgm is None:
            self._set_bgm_controls_enabled(False)
            return
        self._set_bgm_controls_enabled(True)
        self._sync_transport_buttons(playing=playing, paused=paused)

    def _emit_output_change(self) -> None:
        self.output_device_changed.emit(self.output_combo.currentData())

    def _forward_position(self, current: float, total: float) -> None:
        self.bgm_position_changed.emit(current, total)

    def _set_bgm_controls_enabled(self, enabled: bool) -> None:
        for widget in (
            self._btn_prev,
            self._btn_play,
            self._btn_pause,
            self._btn_next,
            self.time_label,
            self.loop_button,
            self.volume_slider,
            self.vol_label,
        ):
            widget.setEnabled(enabled)
        if enabled:
            self._sync_transport_buttons()

    def _sync_transport_buttons(self, *, playing: bool | None = None, paused: bool | None = None) -> None:
        player = BGMPlayer.instance()
        is_playing = player.is_playing if playing is None else playing
        is_paused = player.is_paused if paused is None else paused
        has_bgm = self._current_bgm is not None
        self._btn_prev.setEnabled(False)
        self._btn_next.setEnabled(False)
        self._btn_play.setEnabled(has_bgm and (not is_playing or is_paused))
        self._btn_pause.setEnabled(has_bgm and is_playing)

    def _on_play(self) -> None:
        if self._current_bgm is None:
            return
        player = BGMPlayer.instance()
        if player.is_paused:
            player.resume()
            self._sync_transport_buttons(playing=True, paused=False)
            return
        if not player.is_playing:
            player.play(self._current_bgm.library_path, self.volume_slider.value(), self._loop)
            self._update_time(0.0, self._duration_of(self._current_bgm))
            self._sync_transport_buttons(playing=True, paused=False)

    def _on_pause(self) -> None:
        if self._current_bgm is None:
            return
        player = BGMPlayer.instance()
        if player.is_playing:
            player.pause()
            self._sync_transport_buttons(playing=False, paused=True)

    def _on_loop_toggle(self) -> None:
        self._loop = not self._loop
        BGMPlayer.instance().set_loop(self._loop)
        self._set_loop_style()

    def _set_loop_style(self) -> None:
        self.loop_button.setStyleSheet("color: #4a9eff;" if self._loop else "color: #555566;")

    def _on_volume_changed(self, value: int) -> None:
        BGMPlayer.instance().set_volume(value)
        self.vol_label.setText(str(value))

    def _update_time(self, current: float, total: float) -> None:
        def fmt(seconds: float) -> str:
            return f"{int(seconds // 60)}:{int(seconds % 60):02d}"

        self.time_label.setText(f"{fmt(current)} / {fmt(total)}")

    def _duration_of(self, bgm: BackgroundMusic) -> float:
        try:
            return read_audio_duration(bgm.library_path)
        except Exception:
            return 0.0

    def _retranslate_ui(self, *_args) -> None:
        self.output_label.setText(t("bottom.output_device"))
        self._btn_stop.setToolTip(t("bottom.stop_all"))
        self._btn_prev.setToolTip("上一首")
        self._btn_play.setToolTip("播放")
        self._btn_pause.setToolTip("暂停")
        self._btn_next.setToolTip("下一首")
        self.set_hotkeys_enabled(self.hotkey_toggle.isChecked())
