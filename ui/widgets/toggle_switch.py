from __future__ import annotations

from PyQt6.QtCore import QEasingCurve, QPropertyAnimation, QRectF, Qt, pyqtProperty
from PyQt6.QtGui import QColor, QPainter
from PyQt6.QtWidgets import QAbstractButton


class ToggleSwitch(QAbstractButton):
    def __init__(self, parent=None) -> None:
        super().__init__(parent)
        self.setCheckable(True)
        self.setCursor(Qt.CursorShape.PointingHandCursor)
        self.setFixedSize(48, 26)
        self._offset = 3.0
        self._animation = QPropertyAnimation(self, b"offset", self)
        self._animation.setDuration(140)
        self._animation.setEasingCurve(QEasingCurve.Type.InOutCubic)
        self.toggled.connect(self._animate)

    def sizeHint(self):
        return self.minimumSizeHint()

    def minimumSizeHint(self):
        return self.size()

    def get_offset(self) -> float:
        return self._offset

    def set_offset(self, value: float) -> None:
        self._offset = value
        self.update()

    offset = pyqtProperty(float, get_offset, set_offset)

    def _animate(self, checked: bool) -> None:
        self._animation.stop()
        self._animation.setStartValue(self._offset)
        self._animation.setEndValue(25.0 if checked else 3.0)
        self._animation.start()

    def paintEvent(self, _event) -> None:  # type: ignore[no-untyped-def]
        painter = QPainter(self)
        painter.setRenderHint(QPainter.RenderHint.Antialiasing)
        rect = QRectF(self.rect())
        painter.setPen(Qt.PenStyle.NoPen)
        painter.setBrush(QColor("#4a9eff" if self.isChecked() else "#555566"))
        painter.drawRoundedRect(rect, 13, 13)
        painter.setBrush(QColor("#ffffff"))
        painter.drawEllipse(QRectF(self._offset, 3, 20, 20))
        painter.end()
