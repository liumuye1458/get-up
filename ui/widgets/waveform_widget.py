from __future__ import annotations

import numpy as np
import pyqtgraph as pg
from PyQt6.QtCore import pyqtSignal
import soundfile as sf


class WaveformWidget(pg.PlotWidget):
    trim_changed = pyqtSignal(float, float)

    def __init__(self, parent=None) -> None:
        super().__init__(parent=parent)
        self.setBackground("#0a0a15")
        self.setMouseEnabled(False, False)
        self.hideAxis("left")
        self.hideAxis("bottom")
        self.setMenuEnabled(False)
        self._duration = 0.0
        self._samples = np.array([], dtype=np.float32)
        self._syncing = False

        self._curve_top = pg.PlotCurveItem(pen=pg.mkPen("#3a3a5a", width=1))
        self._curve_bottom = pg.PlotCurveItem(pen=pg.mkPen("#3a3a5a", width=1))
        self.addItem(self._curve_top)
        self.addItem(self._curve_bottom)

        self._region = pg.LinearRegionItem(
            values=(0.0, 1.0),
            movable=False,
            brush=(74, 158, 255, 50),
            pen=pg.mkPen((74, 158, 255, 80)),
        )
        self.addItem(self._region)

        self._left_handle = pg.InfiniteLine(angle=90, movable=True, pen=pg.mkPen("#4a9eff", width=2))
        self._right_handle = pg.InfiniteLine(angle=90, movable=True, pen=pg.mkPen("#ff6b4a", width=2))
        self.addItem(self._left_handle)
        self.addItem(self._right_handle)
        self._left_handle.sigPositionChanged.connect(self._on_handles_changed)
        self._right_handle.sigPositionChanged.connect(self._on_handles_changed)

    @property
    def duration(self) -> float:
        return self._duration

    def load_audio(self, wav_path: str) -> None:
        data, sample_rate = sf.read(wav_path, dtype="float32", always_2d=True)
        mono = np.abs(data.mean(axis=1))
        self._samples = self._downsample(mono, 2000)
        self._duration = len(data) / float(sample_rate)
        self._redraw()
        self.set_trim(0.0, self._duration)

    def set_trim(self, start: float, end: float) -> None:
        if self._duration <= 0:
            return
        start = max(0.0, min(start, self._duration))
        end = max(start + 0.01, min(end, self._duration))
        self._syncing = True
        self._left_handle.setValue(start)
        self._right_handle.setValue(end)
        self._region.setRegion((start, end))
        self._syncing = False

    def clear_trim(self) -> None:
        if self._duration <= 0:
            return
        self.set_trim(0.0, self._duration)

    def _redraw(self) -> None:
        if self._samples.size == 0:
            self._curve_top.setData([], [])
            self._curve_bottom.setData([], [])
            return
        x = np.linspace(0.0, self._duration, self._samples.size)
        self._curve_top.setData(x, self._samples)
        self._curve_bottom.setData(x, -self._samples)
        self.setXRange(0.0, self._duration, padding=0.0)
        self.setYRange(-1.05, 1.05, padding=0.0)

    def _on_handles_changed(self) -> None:
        if self._syncing or self._duration <= 0:
            return
        start = float(self._left_handle.value())
        end = float(self._right_handle.value())
        start = max(0.0, min(start, self._duration - 0.01))
        end = max(start + 0.01, min(end, self._duration))
        self._syncing = True
        self._left_handle.setValue(start)
        self._right_handle.setValue(end)
        self._region.setRegion((start, end))
        self._syncing = False
        self.trim_changed.emit(start, end)

    def _downsample(self, data: np.ndarray, target_points: int) -> np.ndarray:
        if data.size <= target_points:
            return data.astype(np.float32)
        chunk = max(1, len(data) // target_points)
        return np.array(
            [data[index : index + chunk].max() for index in range(0, len(data), chunk)],
            dtype=np.float32,
        )[:target_points]
