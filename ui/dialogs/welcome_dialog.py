from __future__ import annotations

from PyQt6.QtCore import Qt
from PyQt6.QtWidgets import QDialog, QHBoxLayout, QLabel, QPushButton, QVBoxLayout


class WelcomeDialog(QDialog):
    def __init__(self, parent=None) -> None:
        super().__init__(parent)
        self.setWindowTitle("HOTA SoundPad")
        self.setFixedSize(480, 400)
        self.setWindowFlags(Qt.WindowType.Dialog | Qt.WindowType.WindowCloseButtonHint)
        self._setup_ui()

    def _setup_ui(self) -> None:
        layout = QVBoxLayout(self)
        layout.setContentsMargins(36, 32, 36, 28)
        layout.setSpacing(14)

        title = QLabel("HOTA SoundPad")
        title.setStyleSheet("font-size: 20px; font-weight: bold; color: #4a9eff;")
        title.setAlignment(Qt.AlignmentFlag.AlignCenter)
        layout.addWidget(title)

        sub = QLabel(
            "为直播主播设计的专业音效管理工具\n"
            "Professional Sound Effects Manager for Live Streamers"
        )
        sub.setStyleSheet("font-size: 10px; color: #666677;")
        sub.setAlignment(Qt.AlignmentFlag.AlignCenter)
        sub.setWordWrap(True)
        layout.addWidget(sub)

        layout.addSpacing(8)

        features = [
            "导入音效，一键触发，支持多路同时播放\n"
            "Import sounds, one-click trigger, multi-track playback",
            "背景音乐流式播放，循环控制，底部随时切换\n"
            "BGM streaming, loop control, switch anytime from bottom bar",
            "全局 / 局部快捷键，直播推流时也能操控\n"
            "Global / local hotkeys, works while streaming",
            "一键备份恢复，换电脑不丢数据\n"
            "One-click backup & restore, never lose data",
            "支持 MP3 / WAV / OGG / FLAC / WMA 等主流格式\n"
            "Supports MP3 / WAV / OGG / FLAC / WMA and more",
        ]
        for text in features:
            row = QHBoxLayout()
            row.setSpacing(12)

            dot = QLabel("-")
            dot.setFixedWidth(14)
            dot.setStyleSheet("color: #4a9eff; font-size: 12px;")
            dot.setAlignment(Qt.AlignmentFlag.AlignTop | Qt.AlignmentFlag.AlignHCenter)

            text_lbl = QLabel(text)
            text_lbl.setStyleSheet("color: #aaaacc; font-size: 10pt;")
            text_lbl.setWordWrap(True)

            row.addWidget(dot)
            row.addWidget(text_lbl, 1)
            layout.addLayout(row)

        layout.addStretch()

        btn = QPushButton("开始使用 / Get Started")
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
