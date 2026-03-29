from __future__ import annotations

from PyQt6.QtCore import Qt
from PyQt6.QtGui import QKeyEvent, QKeySequence
from PyQt6.QtWidgets import QDialog, QLabel, QPushButton, QVBoxLayout

from core.i18n_manager import t


class HotkeyCaptureDialog(QDialog):
    def __init__(self, current_hotkey: str = "", parent=None) -> None:
        super().__init__(parent)
        self._hotkey = current_hotkey
        self.setModal(True)
        self.setFixedSize(360, 180)
        self.setWindowTitle(t("hotkey_capture.title"))

        layout = QVBoxLayout(self)
        layout.setContentsMargins(24, 24, 24, 24)
        layout.setSpacing(16)

        self.value_label = QLabel(current_hotkey or t("settings.hotkey_unset"), self)
        self.value_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.value_label.setStyleSheet("font-size: 24px; font-weight: 700;")

        self.hint_label = QLabel(t("hotkey_capture.hint"), self)
        self.hint_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.hint_label.setStyleSheet("color: #7f8aa3;")

        self.cancel_button = QPushButton(t("common.cancel"), self)
        self.cancel_button.clicked.connect(self.reject)

        layout.addStretch(1)
        layout.addWidget(self.value_label)
        layout.addWidget(self.hint_label)
        layout.addWidget(self.cancel_button)
        layout.addStretch(1)

    @property
    def hotkey(self) -> str:
        return self._hotkey

    def keyPressEvent(self, event: QKeyEvent) -> None:
        key = event.key()
        modifiers = event.modifiers()

        if key in (
            Qt.Key.Key_Control,
            Qt.Key.Key_Shift,
            Qt.Key.Key_Alt,
            Qt.Key.Key_Meta,
            Qt.Key.Key_unknown,
        ):
            return

        if key == Qt.Key.Key_Escape:
            self._hotkey = ""
            self.reject()
            return

        combo_int = modifiers.value | key
        key_seq = QKeySequence(combo_int)
        self._hotkey = key_seq.toString(QKeySequence.SequenceFormat.PortableText).lower()
        display_text = key_seq.toString(QKeySequence.SequenceFormat.NativeText)
        self.value_label.setText(display_text)
        self.accept()
