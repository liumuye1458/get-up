from __future__ import annotations

from collections.abc import Callable

from PyQt6.QtCore import QPoint, Qt
from PyQt6.QtWidgets import QLabel, QScrollArea, QVBoxLayout, QWidget

from config import CARD_GAP
from core.i18n_manager import I18nManager, t
from models.sound_effect import SoundEffect
from models.tag import Tag
from ui.widgets.flow_layout import FlowLayout
from ui.widgets.sound_card import SoundCard


class SoundCardGrid(QScrollArea):
    def __init__(self, parent=None) -> None:
        super().__init__(parent)
        self.setWidgetResizable(True)
        self.setFrameShape(self.Shape.NoFrame)
        self.setAcceptDrops(True)
        self.viewport().setAcceptDrops(True)
        self._cards: list[SoundCard] = []
        self._on_move: Callable[[str, str], None] | None = None

        self.content = QWidget(self)
        self.content.setAcceptDrops(True)
        self.layout_root = QVBoxLayout(self.content)
        self.layout_root.setContentsMargins(0, 0, 0, 0)
        self.layout_root.setSpacing(12)

        self.empty_label = QLabel(self.content)
        self.empty_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.empty_label.setStyleSheet("color: #7f8aa3; padding: 48px 0;")
        self.layout_root.addWidget(self.empty_label)

        self.flow_host = QWidget(self.content)
        self.flow_host.setAcceptDrops(True)
        self.flow_layout = FlowLayout(self.flow_host, 0, CARD_GAP, CARD_GAP)
        self.layout_root.addWidget(self.flow_host)
        self.layout_root.addStretch(1)
        self.setWidget(self.content)

        I18nManager.events.language_changed.connect(self._retranslate_ui)
        self._retranslate_ui()

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
        self._on_move = on_move
        self.flow_layout.clear()
        self._cards.clear()
        for sound in sounds:
            card = SoundCard(
                sound,
                tags=tags,
                current_tag=current_tag,
                drag_enabled=drag_enabled,
                parent=self.flow_host,
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
            self.flow_layout.addWidget(card)
            self._cards.append(card)
        self.empty_label.setVisible(not sounds)
        self.flow_host.setVisible(bool(sounds))

    def dragEnterEvent(self, event) -> None:  # type: ignore[no-untyped-def]
        if event.mimeData().hasFormat("application/x-soundboard-sound"):
            event.acceptProposedAction()
        else:
            event.ignore()

    def dragMoveEvent(self, event) -> None:  # type: ignore[no-untyped-def]
        if event.mimeData().hasFormat("application/x-soundboard-sound"):
            event.acceptProposedAction()
        else:
            event.ignore()

    def dropEvent(self, event) -> None:  # type: ignore[no-untyped-def]
        if not event.mimeData().hasFormat("application/x-soundboard-sound"):
            event.ignore()
            return
        if self._on_move is None or not self._cards:
            event.ignore()
            return

        source_id = bytes(event.mimeData().data("application/x-soundboard-sound")).decode("utf-8")
        target_id = self._target_sound_id(event.position().toPoint())
        if not target_id or target_id == source_id:
            event.ignore()
            return
        self._on_move(source_id, target_id)
        event.acceptProposedAction()

    def _target_sound_id(self, viewport_pos: QPoint) -> str | None:
        content_pos = self.viewport().mapTo(self.flow_host, viewport_pos)
        for card in self._cards:
            if card.geometry().contains(content_pos):
                return card.sound.id

        nearest: tuple[int, str] | None = None
        for card in self._cards:
            center = card.geometry().center()
            distance = abs(center.x() - content_pos.x()) + abs(center.y() - content_pos.y())
            if nearest is None or distance < nearest[0]:
                nearest = (distance, card.sound.id)
        return nearest[1] if nearest else None

    def _retranslate_ui(self, *_args) -> None:
        self.empty_label.setText(t("sounds.empty"))
