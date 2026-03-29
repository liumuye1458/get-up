from __future__ import annotations

from PyQt6.QtCore import Qt
from PyQt6.QtWidgets import QFrame, QGroupBox, QLabel, QScrollArea, QVBoxLayout, QWidget

from core.i18n_manager import I18nManager


class HelpPage(QWidget):
    def __init__(self, parent=None) -> None:
        super().__init__(parent)
        self._item_labels: list[tuple[QLabel, str, str]] = []
        self._setup_ui()
        I18nManager.events.language_changed.connect(self._retranslate_ui)
        self._retranslate_ui()

    def _get_help_content(self) -> dict[str, str]:
        lang = I18nManager.current_language()
        if lang == "zh":
            return {
                "title": "帮助",
                "section_quick": "快速上手",
                "import_title": "导入音效",
                "import_desc": "点击顶部「+ 添加音效」选择音频文件。支持 MP3 / WAV / OGG / FLAC / WMA / AAC / AIFF / OPUS 等格式，无需额外解码器。",
                "play_title": "播放音效",
                "play_desc": "点击音效卡片即可播放，重复点击会从头播放，多个音效可同时叠加。",
                "hotkey_title": "设置快捷键",
                "hotkey_desc": "右键卡片 → 编辑音效 → 快捷键，点击「录制」后按下目标组合键，如 Ctrl+1 即可绑定。",
                "clip_title": "裁剪音效",
                "clip_desc": "右键卡片 → 裁剪音效，拖动波形上的蓝色 / 橙色手柄选取片段播放。",
                "section_features": "功能说明",
                "tags_title": "标签分类",
                "tags_desc": "点击「+ 新建标签」创建分类。右键卡片可添加到标签。标签支持拖拽排序，删除标签不会删除音效。",
                "bgm_title": "背景音乐",
                "bgm_desc": "切换到「背景音乐」页面导入 BGM，双击即可播放。底部栏可暂停、调节音量、切换循环。",
                "floating_title": "悬浮窗",
                "floating_desc": "一个置顶的迷你控制面板，方便在直播推流或游戏时查看快捷键状态。在设置中开启。",
                "backup_title": "备份与恢复",
                "backup_desc": "备份与恢复页面可将所有音效、BGM 和设置导出为 .zip 文件。导入支持覆盖和合并两种模式。",
                "section_hotkeys": "快捷键",
                "hotkeys_global_title": "全局快捷键",
                "hotkeys_global_desc": "在任何窗口下都可触发，适合直播推流时使用。",
                "hotkeys_local_title": "局部快捷键",
                "hotkeys_local_desc": "仅在本软件窗口聚焦时生效，避免与其他软件冲突。",
                "hotkeys_function_title": "功能快捷键",
                "hotkeys_function_desc": "可自定义停止全部音效、BGM 播放暂停、BGM 音量增减、切换快捷键模式、切换悬浮窗等功能。",
                "section_faq": "常见问题",
                "faq_mp3_title": "MP3 导入失败",
                "faq_mp3_desc": "应用内置了 ffmpeg，正常情况下可直接导入 MP3。若仍失败，请确认文件未损坏，或尝试先转换为 WAV。",
                "faq_hotkey_title": "快捷键无响应",
                "faq_hotkey_desc": "全局快捷键需要管理员权限。若权限不足，程序会自动降级为局部模式。",
                "faq_device_title": "切换输出设备",
                "faq_device_desc": "可在设置页面或底部控制栏切换输出设备，切换后立即生效，无需重启。",
                "faq_data_title": "数据存储位置",
                "faq_data_desc": "音效文件和配置保存在程序目录下的 data 文件夹中，备份时将其一并复制即可。",
                "section_about": "关于",
                "credits_text": "本软件由刘牧野先生倾力打造。从产品构思到功能开发，凝聚了大量的心血与热忱，致力于为直播主播提供最优质的音效管理体验。",
                "contact_text": "如您有任何建议、反馈或合作意向，欢迎通过以下邮箱与我们取得联系：",
                "contact_email": "liumuye.1988@outlook.com",
            }
        return {
            "title": "Help",
            "section_quick": "Quick Start",
            "import_title": "Import Sounds",
            "import_desc": "Click \"+ Add Sounds\" at the top and choose audio files. MP3 / WAV / OGG / FLAC / WMA / AAC / AIFF / OPUS and more are supported without extra codecs.",
            "play_title": "Play Sounds",
            "play_desc": "Click a sound card to play immediately. If it is already playing, it restarts from the beginning. Multiple sounds can overlap.",
            "hotkey_title": "Set Hotkeys",
            "hotkey_desc": "Right-click a card → Edit Sound → Hotkey, then click Record and press your target key combination such as Ctrl+1.",
            "clip_title": "Clip Sounds",
            "clip_desc": "Right-click a card → Clip Sound, then drag the blue / orange handles on the waveform to play only the selected segment.",
            "section_features": "Features",
            "tags_title": "Tag Categories",
            "tags_desc": "Click \"+ New Tag\" to create categories. Use right-click → Add to Tag to classify sounds. Tags support drag sorting, and deleting a tag does not delete sounds.",
            "bgm_title": "Background Music",
            "bgm_desc": "Switch to the Background Music page to import BGM. Double-click an item to start playback. The bottom bar can pause, adjust volume, and toggle loop.",
            "floating_title": "Floating Window",
            "floating_desc": "A tiny always-on-top control panel for checking hotkey status while your streaming software or game stays in the foreground. Toggle it in Settings.",
            "backup_title": "Backup & Restore",
            "backup_desc": "The Backup & Restore page exports all sounds, BGMs, and settings to a .zip file. Import supports both overwrite and merge modes.",
            "section_hotkeys": "Hotkeys",
            "hotkeys_global_title": "Global Hotkeys",
            "hotkeys_global_desc": "Triggers in any window, ideal for use while streaming.",
            "hotkeys_local_title": "Local Hotkeys",
            "hotkeys_local_desc": "Only works when this application is focused, to avoid conflicts with other software.",
            "hotkeys_function_title": "Function Hotkeys",
            "hotkeys_function_desc": "You can customize stop-all, BGM play/pause, BGM volume up/down, toggle hotkey mode, and floating window actions.",
            "section_faq": "FAQ",
            "faq_mp3_title": "MP3 Import Failed",
            "faq_mp3_desc": "The app bundles ffmpeg, so MP3 import should work directly. If it still fails, verify the file is not corrupted or try converting it to WAV first.",
            "faq_hotkey_title": "Hotkeys Not Responding",
            "faq_hotkey_desc": "Global hotkeys require administrator privileges. If permission is unavailable, the app automatically falls back to local mode.",
            "faq_device_title": "Switch Output Device",
            "faq_device_desc": "You can change output devices from the Settings page or the bottom bar, and the new device applies immediately.",
            "faq_data_title": "Where Data Is Stored",
            "faq_data_desc": "Sound files and configuration are stored in the data folder next to the program. Copy that folder together when backing up.",
            "section_about": "About",
            "credits_text": "This software was crafted with dedication by Mr. Liu Muye. From concept to development, it represents a labor of love and passion, committed to delivering the finest sound effects management experience for live streamers.",
            "contact_text": "For suggestions, feedback, or collaboration inquiries, please reach out to us via email:",
            "contact_email": "liumuye.1988@outlook.com",
        }

    def _setup_ui(self) -> None:
        outer = QVBoxLayout(self)
        outer.setContentsMargins(24, 24, 24, 24)
        outer.setSpacing(0)

        self._title = QLabel(self)
        self._title.setObjectName("PageTitle")
        outer.addWidget(self._title)
        outer.addSpacing(16)

        scroll = QScrollArea(self)
        scroll.setWidgetResizable(True)
        scroll.setFrameShape(QFrame.Shape.NoFrame)

        content = QWidget(scroll)
        self._content_layout = QVBoxLayout(content)
        self._content_layout.setContentsMargins(0, 0, 12, 0)
        self._content_layout.setSpacing(6)

        self._section_quick = self._make_section_title()
        self._content_layout.addWidget(self._section_quick)
        self._content_layout.addSpacing(4)
        self._add_item("import_title", "import_desc")
        self._add_item("play_title", "play_desc")
        self._add_item("hotkey_title", "hotkey_desc")
        self._add_item("clip_title", "clip_desc")
        self._add_separator()

        self._section_features = self._make_section_title()
        self._content_layout.addWidget(self._section_features)
        self._content_layout.addSpacing(4)
        self._add_item("tags_title", "tags_desc")
        self._add_item("bgm_title", "bgm_desc")
        self._add_item("floating_title", "floating_desc")
        self._add_item("backup_title", "backup_desc")
        self._add_separator()

        self._section_hotkeys = self._make_section_title()
        self._content_layout.addWidget(self._section_hotkeys)
        self._content_layout.addSpacing(4)
        self._add_item("hotkeys_global_title", "hotkeys_global_desc")
        self._add_item("hotkeys_local_title", "hotkeys_local_desc")
        self._add_item("hotkeys_function_title", "hotkeys_function_desc")
        self._add_separator()

        self._section_faq = self._make_section_title()
        self._content_layout.addWidget(self._section_faq)
        self._content_layout.addSpacing(4)
        self._add_item("faq_mp3_title", "faq_mp3_desc")
        self._add_item("faq_hotkey_title", "faq_hotkey_desc")
        self._add_item("faq_device_title", "faq_device_desc")
        self._add_item("faq_data_title", "faq_data_desc")
        self._add_separator()

        self._credits_group = QGroupBox(self)
        self._credits_group.setStyleSheet(
            """
            QGroupBox {
                color: #4fc3f7; font-size: 15px; font-weight: bold;
                border: 1px solid #333360; border-radius: 8px;
                margin-top: 16px; padding: 20px 16px 16px 16px;
            }
            QGroupBox::title { subcontrol-position: top left; padding: 0 8px; }
            """
        )
        credits_layout = QVBoxLayout(self._credits_group)

        self._credits_text = QLabel(self._credits_group)
        self._credits_text.setWordWrap(True)
        self._credits_text.setStyleSheet("color: #aaa; font-size: 13px; border: none;")
        credits_layout.addWidget(self._credits_text)

        credits_layout.addSpacing(12)

        self._contact_label = QLabel(self._credits_group)
        self._contact_label.setWordWrap(True)
        self._contact_label.setStyleSheet("color: #aaa; font-size: 13px; border: none;")
        credits_layout.addWidget(self._contact_label)

        self._email_label = QLabel(self._credits_group)
        self._email_label.setOpenExternalLinks(True)
        self._email_label.setStyleSheet("font-size: 14px; border: none;")
        credits_layout.addWidget(self._email_label)

        self._content_layout.addWidget(self._credits_group)
        self._content_layout.addStretch()

        scroll.setWidget(content)
        outer.addWidget(scroll)

    def _make_section_title(self) -> QLabel:
        label = QLabel(self)
        label.setObjectName("SectionTitle")
        return label

    def _add_item(self, title_key: str, desc_key: str) -> None:
        label = QLabel(self)
        label.setWordWrap(True)
        label.setTextFormat(Qt.TextFormat.RichText)
        label.setContentsMargins(0, 2, 0, 8)
        self._item_labels.append((label, title_key, desc_key))
        self._content_layout.addWidget(label)

    def _add_separator(self) -> None:
        sep = QFrame()
        sep.setFrameShape(QFrame.Shape.HLine)
        sep.setStyleSheet("color: #1e1e30; margin: 8px 0;")
        self._content_layout.addWidget(sep)

    def _retranslate_ui(self) -> None:
        content = self._get_help_content()
        self._title.setText(content["title"])
        self._section_quick.setText(content["section_quick"])
        self._section_features.setText(content["section_features"])
        self._section_hotkeys.setText(content["section_hotkeys"])
        self._section_faq.setText(content["section_faq"])

        for label, title_key, desc_key in self._item_labels:
            label.setText(
                f"<b style='color:#ccccdd'>{content[title_key]}</b>"
                f"<br><span style='color:#888899'>{content[desc_key]}</span>"
            )

        self._credits_group.setTitle(content["section_about"])
        self._credits_text.setText(content["credits_text"])
        self._contact_label.setText(content["contact_text"])
        self._email_label.setText(
            f'<a href="mailto:{content["contact_email"]}" '
            f'style="color: #4fc3f7; text-decoration: none;">{content["contact_email"]}</a>'
        )
