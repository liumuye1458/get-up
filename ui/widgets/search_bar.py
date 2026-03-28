from __future__ import annotations

from PyQt6.QtCore import QTimer, pyqtSignal
from PyQt6.QtWidgets import QHBoxLayout, QLineEdit, QToolButton, QWidget

from core.i18n_manager import I18nManager, t


class SearchBar(QWidget):
    query_changed = pyqtSignal(str)

    def __init__(self, parent=None) -> None:
        super().__init__(parent)
        self._timer = QTimer(self)
        self._timer.setSingleShot(True)
        self._timer.setInterval(200)
        self._timer.timeout.connect(self._emit_query)

        layout = QHBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(8)

        self.line_edit = QLineEdit(self)
        self.line_edit.textChanged.connect(self._on_text_changed)

        self.clear_button = QToolButton(self)
        self.clear_button.setText("×")
        self.clear_button.clicked.connect(self.line_edit.clear)
        self.clear_button.hide()

        layout.addWidget(self.line_edit)
        layout.addWidget(self.clear_button)

        I18nManager.events.language_changed.connect(self._retranslate_ui)
        self._retranslate_ui()

    def text(self) -> str:
        return self.line_edit.text()

    def _on_text_changed(self, text: str) -> None:
        self.clear_button.setVisible(bool(text))
        self._timer.start()

    def _emit_query(self) -> None:
        self.query_changed.emit(self.line_edit.text())

    def _retranslate_ui(self, *_args) -> None:
        self.line_edit.setPlaceholderText(t("sounds.search.placeholder"))
