from __future__ import annotations

from PyQt6.QtCore import QMimeData, QPoint, QSize, Qt, pyqtSignal
from PyQt6.QtGui import QAction, QColor, QDrag, QMouseEvent, QPainter, QPainterPath
from PyQt6.QtWidgets import QFrame, QHBoxLayout, QLabel, QMenu, QSizePolicy, QVBoxLayout, QWidget

from config import CARD_HEIGHT, CARD_WIDTH
from core.i18n_manager import t
from models.db import db
from models.sound_effect import SoundEffect
from models.tag import Tag


class StatusDot(QWidget):
    def __init__(self, parent=None) -> None:
        super().__init__(parent)
        self._color = QColor("#44dd88")
        self.setFixedSize(10, 10)

    def set_color(self, color: str) -> None:
        self._color = QColor(color)
        self.update()

    def paintEvent(self, _event) -> None:  # type: ignore[no-untyped-def]
        painter = QPainter(self)
        painter.setRenderHint(QPainter.RenderHint.Antialiasing)
        painter.setPen(Qt.PenStyle.NoPen)
        painter.setBrush(self._color)
        painter.drawEllipse(self.rect())
        painter.end()


class SoundCard(QFrame):
    play_requested = pyqtSignal(str)
    replace_requested = pyqtSignal(str)
    edit_requested = pyqtSignal(str)
    clip_requested = pyqtSignal(str)
    duplicate_requested = pyqtSignal(str)
    delete_requested = pyqtSignal(str)
    hotkey_requested = pyqtSignal(str)
    clear_hotkey_requested = pyqtSignal(str)
    toggle_tag_requested = pyqtSignal(str, str)
    remove_current_tag_requested = pyqtSignal(str, str)
    move_requested = pyqtSignal(str, str)

    def __init__(
        self,
        sound: SoundEffect,
        *,
        tags: list[Tag] | None = None,
        current_tag: str = "all",
        drag_enabled: bool = True,
        parent=None,
    ) -> None:
        super().__init__(parent)
        self.sound = sound
        self.tags = tags or []
        self.current_tag = current_tag
        self.drag_enabled = drag_enabled
        self._press_pos = QPoint()
        self._drag_started = False
        self._drop_active = False

        self.setObjectName("SoundCard")
        self.setFixedSize(QSize(CARD_WIDTH, CARD_HEIGHT))
        self.setCursor(Qt.CursorShape.PointingHandCursor)
        self.setSizePolicy(QSizePolicy.Policy.Fixed, QSizePolicy.Policy.Fixed)
        self.setAcceptDrops(True)

        root = QVBoxLayout(self)
        root.setContentsMargins(8, 8, 8, 8)
        root.setSpacing(6)

        self.name_wrap = QFrame(self)
        self.name_wrap.setStyleSheet("background: rgba(0,0,0,0.25); border-radius: 6px;")
        name_layout = QVBoxLayout(self.name_wrap)
        name_layout.setContentsMargins(8, 8, 8, 8)
        self.name_label = QLabel(self.name_wrap)
        self.name_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.name_label.setStyleSheet("font-weight: 700; color: white; background: transparent;")
        name_layout.addWidget(self.name_label)
        root.addWidget(self.name_wrap, 1)

        bottom = QHBoxLayout()
        bottom.setContentsMargins(0, 0, 0, 0)
        self.status_dot = StatusDot(self)
        self.hotkey_label = QLabel(self)
        self.hotkey_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.hotkey_label.setStyleSheet(
            "padding: 2px 6px; border-radius: 4px; background: rgba(0,0,0,0.35); color: white;"
        )
        bottom.addWidget(self.status_dot)
        bottom.addStretch(1)
        bottom.addWidget(self.hotkey_label)
        root.addLayout(bottom)

        db.sounds_changed.connect(self._on_db_changed)
        self.refresh()

    def refresh(self) -> None:
        self.name_label.setText(
            self.fontMetrics().elidedText(self.sound.name, Qt.TextElideMode.ElideRight, 120)
        )
        self.hotkey_label.setVisible(bool(self.sound.hotkey))
        self.hotkey_label.setText(self.sound.hotkey)
        self.status_dot.set_color("#44dd88" if self.sound.enabled else "#555566")
        border = "2px solid #4a9eff" if self._drop_active else "1px solid rgba(255,255,255,0.08)"
        self.setStyleSheet(
            f"#SoundCard {{ background: {self.sound.color}; border-radius: 10px; border: {border}; }}"
        )
        self.update()

    def _on_db_changed(self) -> None:
        updated = db.get_sound(self.sound.id)
        if updated is None:
            return
        self.sound = updated
        self.refresh()

    def mousePressEvent(self, event: QMouseEvent) -> None:
        if event.button() == Qt.MouseButton.LeftButton:
            self._press_pos = event.position().toPoint()
            self._drag_started = False
        elif event.button() == Qt.MouseButton.RightButton:
            self._open_menu(event.globalPosition().toPoint())
        super().mousePressEvent(event)

    def mouseMoveEvent(self, event: QMouseEvent) -> None:
        if not self.drag_enabled or not (event.buttons() & Qt.MouseButton.LeftButton):
            return super().mouseMoveEvent(event)
        if (event.position().toPoint() - self._press_pos).manhattanLength() < 8:
            return super().mouseMoveEvent(event)
        self._drag_started = True
        drag = QDrag(self)
        mime = QMimeData()
        mime.setData("application/x-soundboard-sound", self.sound.id.encode("utf-8"))
        drag.setMimeData(mime)
        drag.setPixmap(self.grab())
        drag.exec(Qt.DropAction.MoveAction)

    def mouseReleaseEvent(self, event: QMouseEvent) -> None:
        if (
            event.button() == Qt.MouseButton.LeftButton
            and not self._drag_started
            and self.sound.enabled
        ):
            self.play_requested.emit(self.sound.id)
        self._drag_started = False
        super().mouseReleaseEvent(event)

    def dragEnterEvent(self, event) -> None:  # type: ignore[no-untyped-def]
        if self.drag_enabled and event.mimeData().hasFormat("application/x-soundboard-sound"):
            self._drop_active = True
            self.refresh()
            event.acceptProposedAction()

    def dragLeaveEvent(self, event) -> None:  # type: ignore[no-untyped-def]
        self._drop_active = False
        self.refresh()
        super().dragLeaveEvent(event)

    def dropEvent(self, event) -> None:  # type: ignore[no-untyped-def]
        self._drop_active = False
        self.refresh()
        source_id = bytes(event.mimeData().data("application/x-soundboard-sound")).decode("utf-8")
        if self.drag_enabled and source_id and source_id != self.sound.id:
            self.move_requested.emit(source_id, self.sound.id)
            event.acceptProposedAction()

    def paintEvent(self, event) -> None:  # type: ignore[no-untyped-def]
        super().paintEvent(event)
        if self.sound.enabled:
            return
        painter = QPainter(self)
        painter.setRenderHint(QPainter.RenderHint.Antialiasing)
        overlay = QPainterPath()
        overlay.addRoundedRect(0, 0, self.width(), self.height(), 10, 10)
        painter.fillPath(overlay, QColor(0, 0, 0, 128))
        painter.end()

    def _open_menu(self, global_pos) -> None:  # type: ignore[no-untyped-def]
        menu = QMenu(self)

        play_action = QAction(t("card.play"), menu)
        play_action.triggered.connect(lambda: self.play_requested.emit(self.sound.id))
        menu.addAction(play_action)
        menu.addSeparator()

        replace_action = QAction(t("card.replace"), menu)
        replace_action.triggered.connect(lambda: self.replace_requested.emit(self.sound.id))
        menu.addAction(replace_action)

        edit_action = QAction(t("card.edit"), menu)
        edit_action.triggered.connect(lambda: self.edit_requested.emit(self.sound.id))
        menu.addAction(edit_action)

        clip_action = QAction(t("card.clip"), menu)
        clip_action.triggered.connect(lambda: self.clip_requested.emit(self.sound.id))
        menu.addAction(clip_action)

        duplicate_action = QAction(t("card.copy"), menu)
        duplicate_action.triggered.connect(lambda: self.duplicate_requested.emit(self.sound.id))
        menu.addAction(duplicate_action)

        if self.tags:
            tags_menu = menu.addMenu("添加到标签")
            for tag in self.tags:
                action = QAction(tag.name, tags_menu)
                action.setCheckable(True)
                action.setChecked(tag.id in self.sound.tags)
                action.triggered.connect(
                    lambda checked=False, tag_id=tag.id: self.toggle_tag_requested.emit(self.sound.id, tag_id)
                )
                tags_menu.addAction(action)

        if self.current_tag != "all" and self.current_tag in self.sound.tags:
            remove_tag_action = QAction("从此标签移除", menu)
            remove_tag_action.triggered.connect(
                lambda: self.remove_current_tag_requested.emit(self.sound.id, self.current_tag)
            )
            menu.addAction(remove_tag_action)

        hotkey_action = QAction(t("card.set_hotkey"), menu)
        hotkey_action.triggered.connect(lambda: self.hotkey_requested.emit(self.sound.id))
        menu.addAction(hotkey_action)

        clear_hotkey_action = QAction(t("card.clear_hotkey"), menu)
        clear_hotkey_action.triggered.connect(lambda: self.clear_hotkey_requested.emit(self.sound.id))
        clear_hotkey_action.setEnabled(bool(self.sound.hotkey))
        menu.addAction(clear_hotkey_action)

        menu.addSeparator()
        delete_action = QAction(t("card.delete"), menu)
        delete_action.triggered.connect(lambda: self.delete_requested.emit(self.sound.id))
        menu.addAction(delete_action)
        menu.exec(global_pos)
