from __future__ import annotations

from PyQt6.QtCore import pyqtSignal
from PyQt6.QtWidgets import QButtonGroup, QGridLayout, QPushButton, QWidget

from config import PRESET_COLORS


class ColorPicker(QWidget):
    color_changed = pyqtSignal(str)

    def __init__(self, parent=None) -> None:
        super().__init__(parent)
        self._buttons: dict[str, QPushButton] = {}
        self._group = QButtonGroup(self)
        self._group.setExclusive(True)

        layout = QGridLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setHorizontalSpacing(8)
        layout.setVerticalSpacing(8)

        for index, color in enumerate(PRESET_COLORS):
            button = QPushButton(self)
            button.setCheckable(True)
            button.setFixedSize(28, 28)
            button.setStyleSheet(self._style_for(color, False))
            button.clicked.connect(lambda checked=False, value=color: self._on_color_clicked(value))
            self._group.addButton(button, index)
            self._buttons[color] = button
            layout.addWidget(button, index // 4, index % 4)

        self.set_color(PRESET_COLORS[0])

    def color(self) -> str:
        for color, button in self._buttons.items():
            if button.isChecked():
                return color
        return PRESET_COLORS[0]

    def set_color(self, color: str) -> None:
        target = color if color in self._buttons else PRESET_COLORS[0]
        for value, button in self._buttons.items():
            checked = value == target
            button.blockSignals(True)
            button.setChecked(checked)
            button.blockSignals(False)
            button.setStyleSheet(self._style_for(value, checked))

    def _on_color_clicked(self, color: str) -> None:
        self.set_color(color)
        self.color_changed.emit(color)

    def _style_for(self, color: str, checked: bool) -> str:
        border = "2px solid #ffffff" if checked else "1px solid rgba(255,255,255,0.15)"
        return (
            "QPushButton {"
            f"background: {color};"
            f"border: {border};"
            "border-radius: 14px;"
            "}"
        )
