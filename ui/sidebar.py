from __future__ import annotations

from PyQt6.QtCore import Qt, pyqtSignal
from PyQt6.QtGui import QIcon
from PyQt6.QtWidgets import QButtonGroup, QFrame, QHBoxLayout, QLabel, QPushButton, QVBoxLayout, QWidget

from config import ICONS_DIR
from core.i18n_manager import I18nManager, t


class Sidebar(QWidget):
    page_selected = pyqtSignal(int)

    def __init__(self, parent=None) -> None:
        super().__init__(parent)
        self.setFixedWidth(180)

        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)

        logo_wrap = QFrame(self)
        logo_wrap.setFixedHeight(64)
        logo_layout = QHBoxLayout(logo_wrap)
        logo_layout.setContentsMargins(20, 0, 20, 0)
        logo_layout.setSpacing(10)
        self.logo = QLabel("", logo_wrap)
        self.logo.setStyleSheet("font-size: 20px; color: white; font-weight: 700;")
        self.title_label = QLabel(logo_wrap)
        self.title_label.setStyleSheet("font-size: 14px; font-weight: 700; color: white;")
        logo_layout.addWidget(self.logo)
        logo_layout.addWidget(self.title_label, 1)
        layout.addWidget(logo_wrap)

        self.group = QButtonGroup(self)
        self.group.setExclusive(True)
        self.buttons: list[QPushButton] = []
        self._keys = ["nav.sounds", "nav.bgm", "nav.backup", "nav.settings", "nav.help"]
        icon_names = ["sounds.svg", "bgm.svg", "backup.svg", "settings.svg", "app.svg"]
        for index, (icon_name, key) in enumerate(zip(icon_names, self._keys, strict=True)):
            button = QPushButton(self)
            button.setObjectName("NavButton")
            button.setProperty("selected", "false")
            button.setCheckable(True)
            button.setIcon(QIcon(str(ICONS_DIR / icon_name)))
            button.setCursor(Qt.CursorShape.PointingHandCursor)
            button.clicked.connect(lambda checked=False, idx=index: self.page_selected.emit(idx))
            self.group.addButton(button, index)
            layout.addWidget(button)
            self.buttons.append(button)
        layout.addStretch(1)

        I18nManager.events.language_changed.connect(self._retranslate_ui)
        self.select_page(0)
        self._retranslate_ui()

    def select_page(self, index: int) -> None:
        for idx, button in enumerate(self.buttons):
            button.setChecked(idx == index)
            button.setProperty("selected", "true" if idx == index else "false")
            button.style().unpolish(button)
            button.style().polish(button)

    def _retranslate_ui(self, *_args) -> None:
        self.title_label.setText(t("app.title"))
        for button, key in zip(self.buttons, self._keys, strict=True):
            button.setText(t(key))
