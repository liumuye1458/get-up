from __future__ import annotations

from collections.abc import Callable

from PyQt6.QtCore import Qt
from PyQt6.QtWidgets import QFrame, QScrollArea, QVBoxLayout, QWidget

from models.sound_effect import SoundEffect
from models.tag import Tag
from ui.widgets.flow_layout import FlowLayout
from ui.widgets.sound_card import SoundCard


class SoundCardGrid(QWidget):
    def __init__(self, parent=None) -> None:
        super().__init__(parent)
        self._cards: list[SoundCard] = []

        root = QVBoxLayout(self)
        root.setContentsMargins(0, 0, 0, 0)
        root.setSpacing(0)

        self._scroll = QScrollArea(self)
        self._scroll.setWidgetResizable(True)
        self._scroll.setFrameShape(QFrame.Shape.NoFrame)
        self._scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)

        self._content = QWidget(self._scroll)
        self._flow = FlowLayout(self._content, margin=0, h_spacing=12, v_spacing=12)
        self._content.setLayout(self._flow)
        self._scroll.setWidget(self._content)

        root.addWidget(self._scroll)

    def set_sounds(
        self,
        sounds: list[SoundEffect],
        *,
        tags: list[Tag],
        current_tag: str,
        drag_enabled: bool,
        on_play: Callable[[str], None],
        on_replace: Callable[[str], None],
        on_edit: Callable[[str], None],
        on_clip: Callable[[str], None],
        on_duplicate: Callable[[str], None],
        on_delete: Callable[[str], None],
        on_set_hotkey: Callable[[str], None],
        on_clear_hotkey: Callable[[str], None],
        on_toggle_tag: Callable[[str, str], None],
        on_remove_current_tag: Callable[[str, str], None],
        on_move: Callable[[str, str], None],
    ) -> None:
        self._flow.clear()
        self._cards.clear()

        for sound in sounds:
            card = SoundCard(
                sound,
                tags=tags,
                current_tag=current_tag,
                drag_enabled=drag_enabled,
                parent=self._content,
            )
            card.play_requested.connect(on_play)
            card.replace_requested.connect(on_replace)
            card.edit_requested.connect(on_edit)
            card.clip_requested.connect(on_clip)
            card.duplicate_requested.connect(on_duplicate)
            card.delete_requested.connect(on_delete)
            card.hotkey_requested.connect(on_set_hotkey)
            card.clear_hotkey_requested.connect(on_clear_hotkey)
            card.toggle_tag_requested.connect(on_toggle_tag)
            card.remove_current_tag_requested.connect(on_remove_current_tag)
            card.move_requested.connect(on_move)
            self._flow.addWidget(card)
            self._cards.append(card)
