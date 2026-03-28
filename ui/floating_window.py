from __future__ import annotations

from PyQt6.QtCore import QPoint, Qt, pyqtSignal
from PyQt6.QtGui import QColor, QLinearGradient, QPainter, QPaintEvent
from PyQt6.QtWidgets import QHBoxLayout, QLabel, QVBoxLayout, QWidget

from core.i18n_manager import I18nManager, t
from ui.widgets.toggle_switch import ToggleSwitch


class FloatingWindow(QWidget):
    hotkeys_enabled_changed = pyqtSignal(bool)
    moved = pyqtSignal(int, int)

    def __init__(self, parent=None) -> None:
        super().__init__(parent)
        self._drag_pos: QPoint | None = None
        self.setWindowFlags(
            Qt.WindowType.WindowStaysOnTopHint
            | Qt.WindowType.FramelessWindowHint
            | Qt.WindowType.Tool
        )
        self.setFixedSize(280, 68)
        self.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground)

        root = QVBoxLayout(self)
        root.setContentsMargins(0, 0, 0, 0)
        root.setSpacing(0)

        top = QWidget(self)
        top_layout = QHBoxLayout(top)
        top_layout.setContentsMargins(8, 8, 8, 8)
        top_layout.setSpacing(8)

        self.icon_label = QLabel("♪", top)
        self.icon_label.setStyleSheet("color: white; font-weight: 700;")
        self.title_label = QLabel(top)
        self.title_label.setStyleSheet("color: white; font-weight: 700;")
        self.toggle = ToggleSwitch(top)
        self.toggle.setChecked(True)
        self.toggle.toggled.connect(self.hotkeys_enabled_changed.emit)
        self.mode_label = QLabel(top)
        self.mode_label.setStyleSheet("color: rgba(255,255,255,0.85); font-size: 11px;")

        top_layout.addWidget(self.icon_label)
        top_layout.addWidget(self.title_label)
        top_layout.addWidget(self.toggle)
        top_layout.addWidget(self.mode_label, 1)
        root.addWidget(top, 1)

        bottom = QWidget(self)
        bottom.setStyleSheet(
            "background: #1565d8; border-bottom-left-radius: 8px; border-bottom-right-radius: 8px;"
        )
        bottom_layout = QHBoxLayout(bottom)
        bottom_layout.setContentsMargins(8, 2, 8, 2)
        self.switch_hotkey_label = QLabel(bottom)
        self.switch_hotkey_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.switch_hotkey_label.setStyleSheet("color: white; font-size: 10px; background: transparent;")
        bottom_layout.addWidget(self.switch_hotkey_label)
        root.addWidget(bottom)

        I18nManager.events.language_changed.connect(self._retranslate_ui)
        self._retranslate_ui()

    def set_hotkeys_enabled(self, enabled: bool) -> None:
        self.toggle.blockSignals(True)
        self.toggle.setChecked(enabled)
        self.toggle.blockSignals(False)

    def set_mode_label(self, mode: str) -> None:
        mapping = {
            "global": t("floating.mode_global"),
            "local": t("floating.mode_local"),
            "disabled": t("floating.mode_off"),
        }
        self.mode_label.setText(mapping.get(mode, t("floating.mode_off")))

    def set_switch_hotkey_text(self, hotkey: str) -> None:
        self.switch_hotkey_label.setText(
            f"切换快捷键：{hotkey}" if hotkey else t("floating.no_switch_hotkey")
        )

    def mousePressEvent(self, event) -> None:  # type: ignore[no-untyped-def]
        if event.button() == Qt.MouseButton.LeftButton:
            self._drag_pos = event.globalPosition().toPoint() - self.frameGeometry().topLeft()
        super().mousePressEvent(event)

    def mouseMoveEvent(self, event) -> None:  # type: ignore[no-untyped-def]
        if event.buttons() & Qt.MouseButton.LeftButton and self._drag_pos is not None:
            self.move(event.globalPosition().toPoint() - self._drag_pos)
        super().mouseMoveEvent(event)

    def mouseReleaseEvent(self, event) -> None:  # type: ignore[no-untyped-def]
        self._drag_pos = None
        self.moved.emit(self.x(), self.y())
        super().mouseReleaseEvent(event)

    def paintEvent(self, _event: QPaintEvent) -> None:
        painter = QPainter(self)
        painter.setRenderHint(QPainter.RenderHint.Antialiasing)
        gradient = QLinearGradient(0, 0, 0, self.height())
        gradient.setColorAt(0.0, QColor("#1a2a5a"))
        gradient.setColorAt(1.0, QColor("#1e4fc8"))
        painter.setBrush(gradient)
        painter.setPen(Qt.PenStyle.NoPen)
        painter.drawRoundedRect(self.rect(), 8, 8)
        painter.end()

    def _retranslate_ui(self, *_args) -> None:
        self.title_label.setText(t("floating.hotkey_switch"))
