from __future__ import annotations

from PyQt6.QtCore import Qt
from PyQt6.QtWidgets import QDialog, QHBoxLayout, QLabel, QPushButton, QVBoxLayout

from core.i18n_manager import t


class WelcomeDialog(QDialog):
    def __init__(self, parent=None) -> None:
        super().__init__(parent)
        self.setWindowTitle(t("welcome.title"))
        self.setFixedSize(480, 400)
        self.setWindowFlags(Qt.WindowType.Dialog | Qt.WindowType.WindowCloseButtonHint)
        self._setup_ui()

    def _setup_ui(self) -> None:
        layout = QVBoxLayout(self)
        layout.setContentsMargins(36, 32, 36, 28)
        layout.setSpacing(14)

        title = QLabel(t("welcome.title"))
        title.setStyleSheet("font-size: 20px; font-weight: bold; color: #4a9eff;")
        title.setAlignment(Qt.AlignmentFlag.AlignCenter)
        layout.addWidget(title)

        sub = QLabel(t("welcome.subtitle"))
        sub.setStyleSheet("font-size: 10px; color: #666677;")
        sub.setAlignment(Qt.AlignmentFlag.AlignCenter)
        layout.addWidget(sub)

        layout.addSpacing(8)

        features = [
            ("●", t("welcome.feat1")),
            ("●", t("welcome.feat2")),
            ("●", t("welcome.feat3")),
            ("●", t("welcome.feat4")),
            ("●", t("welcome.feat5")),
        ]
        for icon, text in features:
            row = QHBoxLayout()
            row.setSpacing(12)

            dot = QLabel(icon)
            dot.setFixedWidth(14)
            dot.setStyleSheet("color: #4a9eff; font-size: 8px;")
            dot.setAlignment(Qt.AlignmentFlag.AlignTop | Qt.AlignmentFlag.AlignHCenter)

            text_lbl = QLabel(text)
            text_lbl.setStyleSheet("color: #aaaacc; font-size: 10pt;")
            text_lbl.setWordWrap(True)

            row.addWidget(dot)
            row.addWidget(text_lbl, 1)
            layout.addLayout(row)

        layout.addStretch()

        btn = QPushButton(t("welcome.start"))
        btn.setFixedHeight(42)
        btn.setStyleSheet(
            """
            QPushButton {
                background-color: #1a6b8a;
                color: white;
                font-size: 12pt;
                font-weight: bold;
                border-radius: 8px;
                border: none;
            }
            QPushButton:hover {
                background-color: #1e7fa0;
            }
            QPushButton:pressed {
                background-color: #155a75;
            }
            """
        )
        btn.clicked.connect(self.accept)
        layout.addWidget(btn)
