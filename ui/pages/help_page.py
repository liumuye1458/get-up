from __future__ import annotations

from PyQt6.QtCore import Qt
from PyQt6.QtWidgets import QFrame, QLabel, QScrollArea, QVBoxLayout, QWidget


class HelpPage(QWidget):
    def __init__(self, parent=None) -> None:
        super().__init__(parent)
        self._setup_ui()

    def _setup_ui(self) -> None:
        outer = QVBoxLayout(self)
        outer.setContentsMargins(24, 24, 24, 24)
        outer.setSpacing(0)

        title = QLabel("帮助与说明")
        title.setObjectName("PageTitle")
        outer.addWidget(title)
        outer.addSpacing(16)

        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setFrameShape(QFrame.Shape.NoFrame)

        content = QWidget()
        cl = QVBoxLayout(content)
        cl.setContentsMargins(0, 0, 12, 0)
        cl.setSpacing(6)

        sections = [
            (
                "快速上手",
                [
                    (
                        "导入音效",
                        "点击顶部「+ 添加音效」，选择音频文件。支持 MP3 / WAV / OGG / FLAC / WMA / AAC / AIFF / OPUS 等格式，无需额外安装解码器。",
                    ),
                    (
                        "播放音效",
                        "单击音效卡片立即播放；若音效正在播放则从头重播；多个音效可同时叠加播放。",
                    ),
                    (
                        "设置快捷键",
                        "右键卡片 → 编辑音效 → 快捷键，点击「录制」后按下目标组合键（如 Ctrl+1）即可绑定。",
                    ),
                    (
                        "剪辑音效",
                        "右键卡片 → 剪辑音效，拖动波形两端的蓝色 / 橙色标记点，只播放选定的片段。",
                    ),
                ],
            ),
            (
                "功能说明",
                [
                    (
                        "标签分类",
                        "点击「+ 新建标签」创建分类；右键卡片「添加到标签」归类；标签栏支持拖拽排序；删除标签不会删除音效。",
                    ),
                    (
                        "背景音乐",
                        "切换到「背景音乐」页导入 BGM，双击列表项开始播放，底部控制栏可暂停 / 调整音量 / 切换循环。",
                    ),
                    (
                        "悬浮窗",
                        "始终置顶的迷你控制面板，可在直播推流软件或游戏前台查看快捷键状态。可通过「设置 → 悬浮窗」开关。",
                    ),
                    (
                        "备份恢复",
                        "「备份」页可将所有音效、BGM 和配置导出为 .zip 文件；导入时可选择「覆盖」（完全替换）或「合并」（保留现有数据）。",
                    ),
                ],
            ),
            (
                "快捷键说明",
                [
                    (
                        "全局模式",
                        "快捷键在任何窗口下均生效，包括直播推流软件或游戏前台运行时。需要管理员权限；若权限不足会自动降级为局部模式。",
                    ),
                    (
                        "局部模式",
                        "仅在本应用窗口获得焦点时生效。适合不需要后台触发的场景，无需特殊权限。",
                    ),
                    (
                        "功能快捷键",
                        "在「设置 → 功能快捷键」中可自定义：停止全部音效、BGM 播放暂停、BGM 音量增减、切换快捷键模式、最小化窗口、显示悬浮窗等。",
                    ),
                ],
            ),
            (
                "常见问题",
                [
                    (
                        "MP3 导入失败",
                        "本应用内置了 ffmpeg，正常情况下可直接导入 MP3。若仍失败，请确认文件未损坏，或尝试先用其他软件转为 WAV。",
                    ),
                    (
                        "快捷键无响应（全局模式）",
                        "全局快捷键需要管理员权限。请右键点击 直播音效板.exe，选择「以管理员身份运行」。",
                    ),
                    (
                        "切换输出设备",
                        "在「设置 → 输出设备」或底部控制栏的下拉框中选择目标设备，切换后立即生效，无需重启。",
                    ),
                    (
                        "数据存储位置",
                        "所有音效文件和配置保存在 直播音效板.exe 同级的 data/ 文件夹中，备份时将该文件夹一并复制即可。",
                    ),
                ],
            ),
        ]

        for sec_title, items in sections:
            sec_lbl = QLabel(sec_title)
            sec_lbl.setObjectName("SectionTitle")
            cl.addWidget(sec_lbl)
            cl.addSpacing(4)

            for item_title, item_desc in items:
                lbl = QLabel(
                    f"<b style='color:#ccccdd'>{item_title}</b>"
                    f"<br><span style='color:#888899'>{item_desc}</span>"
                )
                lbl.setWordWrap(True)
                lbl.setTextFormat(Qt.TextFormat.RichText)
                lbl.setContentsMargins(0, 2, 0, 8)
                cl.addWidget(lbl)

            sep = QFrame()
            sep.setFrameShape(QFrame.Shape.HLine)
            sep.setStyleSheet("color: #1e1e30; margin: 8px 0;")
            cl.addWidget(sep)

        cl.addStretch()
        scroll.setWidget(content)
        outer.addWidget(scroll)

    def _retranslate_ui(self) -> None:
        pass
