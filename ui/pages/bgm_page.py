from __future__ import annotations

from pathlib import Path

from PyQt6.QtCore import Qt, pyqtSignal
from PyQt6.QtGui import QAction
from PyQt6.QtWidgets import (
    QAbstractItemView,
    QFileDialog,
    QHBoxLayout,
    QLabel,
    QListWidget,
    QListWidgetItem,
    QMenu,
    QMessageBox,
    QPushButton,
    QVBoxLayout,
    QWidget,
)

from config import BGM_DIR, SUPPORTED_AUDIO_FORMATS
from core.audio_engine import BGMPlayer
from core.i18n_manager import I18nManager, t
from models.bgm import BackgroundMusic
from models.db import db
from ui.dialogs.bgm_edit_dialog import BgmEditDialog
from utils.audio_utils import import_audio_file, read_audio_duration


class BgmListWidget(QListWidget):
    order_changed = pyqtSignal()

    def __init__(self, parent=None) -> None:
        super().__init__(parent)
        self.setDragEnabled(True)
        self.setAcceptDrops(True)
        self.setDropIndicatorShown(True)
        self.setDragDropMode(QAbstractItemView.DragDropMode.InternalMove)
        self.setDefaultDropAction(Qt.DropAction.MoveAction)

    def dropEvent(self, event) -> None:  # type: ignore[no-untyped-def]
        super().dropEvent(event)
        self.order_changed.emit()


class BgmListItem(QWidget):
    preview_requested = pyqtSignal(str)
    menu_requested = pyqtSignal(str, QWidget)

    def __init__(self, bgm: BackgroundMusic, parent=None) -> None:
        super().__init__(parent)
        self.bgm = bgm
        self.setFixedHeight(56)

        layout = QHBoxLayout(self)
        layout.setContentsMargins(8, 8, 8, 8)
        layout.setSpacing(10)

        self.status_dot = QLabel(self)
        self.status_dot.setFixedSize(10, 10)
        self.status_dot.setStyleSheet(
            f"border-radius: 5px; background: {'#23c26b' if bgm.enabled else '#6b7280'};"
        )
        layout.addWidget(self.status_dot, 0, Qt.AlignmentFlag.AlignVCenter)

        center = QVBoxLayout()
        center.setContentsMargins(0, 0, 0, 0)
        center.setSpacing(2)
        self.name_label = QLabel(bgm.name, self)
        self.name_label.setStyleSheet("font-weight: 700;")
        self.name_label.setWordWrap(False)
        self.sub_label = QLabel(self._subtitle(), self)
        self.sub_label.setStyleSheet("color: #7f8aa3; font-size: 10px;")
        center.addWidget(self.name_label)
        center.addWidget(self.sub_label)
        layout.addLayout(center, 1)

        self.preview_button = QPushButton(">", self)
        self.preview_button.setFixedSize(28, 28)
        self.preview_button.clicked.connect(lambda: self.preview_requested.emit(self.bgm.id))
        self.more_button = QPushButton("...", self)
        self.more_button.setFixedSize(28, 28)
        self.more_button.clicked.connect(lambda: self.menu_requested.emit(self.bgm.id, self.more_button))
        layout.addWidget(self.preview_button)
        layout.addWidget(self.more_button)

    def _subtitle(self) -> str:
        try:
            duration = read_audio_duration(self.bgm.library_path)
        except Exception:
            duration = 0.0
        mins = int(duration // 60)
        secs = int(duration % 60)
        hotkey = self.bgm.hotkey or t("bgm.hotkey_unset")
        return f"{mins}:{secs:02d} · {hotkey}"


class BgmPage(QWidget):
    play_requested = pyqtSignal(str)
    status_message = pyqtSignal(str)

    def __init__(self, parent=None) -> None:
        super().__init__(parent)
        self.setAcceptDrops(True)

        layout = QVBoxLayout(self)
        layout.setContentsMargins(16, 16, 16, 16)
        layout.setSpacing(12)

        header = QHBoxLayout()
        self.title_label = QLabel(self)
        self.title_label.setStyleSheet("font-size: 16px; font-weight: 700;")
        self.add_button = QPushButton(self)
        self.add_button.clicked.connect(self._add_bgms)
        header.addWidget(self.title_label)
        header.addStretch(1)
        header.addWidget(self.add_button)
        layout.addLayout(header)

        self.list_widget = BgmListWidget(self)
        self.list_widget.setSpacing(6)
        self.list_widget.setStyleSheet(
            "QListWidget { background: transparent; border: none; }"
            "QListWidget::item { background: #11111a; border: 1px solid #1e2233; border-radius: 10px; padding: 0; }"
            "QListWidget::item:selected { background: #161c2b; }"
        )
        self.list_widget.itemDoubleClicked.connect(self._on_item_double_clicked)
        self.list_widget.order_changed.connect(self._persist_order)
        layout.addWidget(self.list_widget, 1)

        db.bgm_changed.connect(self.refresh)
        I18nManager.events.language_changed.connect(self._retranslate_ui)
        self.refresh()
        self._retranslate_ui()

    def refresh(self) -> None:
        self.list_widget.clear()
        for bgm in db.all_bgms():
            item = QListWidgetItem()
            item.setData(Qt.ItemDataRole.UserRole, bgm.id)
            widget = BgmListItem(bgm, self.list_widget)
            widget.preview_requested.connect(self.play_requested.emit)
            widget.menu_requested.connect(self._show_item_menu)
            item.setSizeHint(widget.sizeHint())
            self.list_widget.addItem(item)
            self.list_widget.setItemWidget(item, widget)

    def import_files(self, paths: list[Path]) -> None:
        for source_path in paths:
            stored = import_audio_file(source_path, BGM_DIR)
            bgm = BackgroundMusic.create(
                name=source_path.stem,
                original_filename=source_path.name,
                library_path=str(stored),
                sort_order=db.next_bgm_sort_order(),
            )
            db.add_bgm(bgm)

    def _add_bgms(self) -> None:
        exts = " ".join(SUPPORTED_AUDIO_FORMATS)
        filter_str = f"音频文件 ({exts})"
        files, _ = QFileDialog.getOpenFileNames(self, "选择音频文件", "", filter_str)
        if not files:
            return
        try:
            self.import_files([Path(file_path) for file_path in files])
        except Exception as exc:  # noqa: BLE001
            self.status_message.emit(str(exc))

    def dragEnterEvent(self, event) -> None:  # type: ignore[no-untyped-def]
        if event.mimeData().hasUrls():
            event.acceptProposedAction()
        else:
            event.ignore()

    def dragMoveEvent(self, event) -> None:  # type: ignore[no-untyped-def]
        if event.mimeData().hasUrls():
            event.acceptProposedAction()
        else:
            event.ignore()

    def dropEvent(self, event) -> None:  # type: ignore[no-untyped-def]
        if not event.mimeData().hasUrls():
            return

        supported_exts = {fmt.lstrip("*").lower() for fmt in SUPPORTED_AUDIO_FORMATS}
        audio_files: list[Path] = []
        for url in event.mimeData().urls():
            path = Path(url.toLocalFile())
            if path.is_file() and path.suffix.lower() in supported_exts:
                audio_files.append(path)
            elif path.is_dir():
                for ext in supported_exts:
                    audio_files.extend(path.rglob(f"*{ext}"))

        unique_files = sorted({item.resolve() for item in audio_files})
        if unique_files:
            try:
                self.import_files(unique_files)
            except Exception as exc:  # noqa: BLE001
                self.status_message.emit(str(exc))
        event.acceptProposedAction()

    def _on_item_double_clicked(self, item: QListWidgetItem) -> None:
        bgm_id = str(item.data(Qt.ItemDataRole.UserRole))
        self.play_requested.emit(bgm_id)

    def _show_item_menu(self, bgm_id: str, anchor: QWidget) -> None:
        bgm = db.get_bgm(bgm_id)
        if bgm is None:
            return

        menu = QMenu(self)
        player = BGMPlayer.instance()
        playing_current = player.is_playing and self._current_bgm_id() == bgm_id
        play_action = QAction(t("bgm.menu.pause") if playing_current else t("bgm.menu.play"), menu)
        play_action.triggered.connect(
            player.pause if playing_current else lambda: self.play_requested.emit(bgm_id)
        )
        menu.addAction(play_action)
        menu.addSeparator()

        edit_action = QAction(t("bgm.menu.edit"), menu)
        edit_action.triggered.connect(lambda: self._edit_bgm(bgm_id))
        menu.addAction(edit_action)

        duplicate_action = QAction(t("bgm.menu.duplicate"), menu)
        duplicate_action.triggered.connect(lambda: db.duplicate_bgm(bgm_id))
        menu.addAction(duplicate_action)

        menu.addSeparator()
        delete_action = QAction(t("bgm.menu.delete"), menu)
        delete_action.triggered.connect(lambda: self._delete_bgm(bgm_id))
        menu.addAction(delete_action)
        menu.exec(anchor.mapToGlobal(anchor.rect().bottomLeft()))

    def _edit_bgm(self, bgm_id: str) -> None:
        bgm = db.get_bgm(bgm_id)
        if bgm is None:
            return
        dialog = BgmEditDialog(bgm, parent=self)
        dialog.exec()

    def _delete_bgm(self, bgm_id: str) -> None:
        bgm = db.get_bgm(bgm_id)
        if bgm is None:
            return
        confirmed = QMessageBox.question(
            self,
            t("bgm.delete_title"),
            t("bgm.delete_confirm", name=bgm.name),
        )
        if confirmed != QMessageBox.StandardButton.Yes:
            return
        removed = db.delete_bgm(bgm_id)
        if removed is None:
            return
        path = Path(removed.library_path)
        if path.exists() and not any(item.library_path == removed.library_path for item in db.all_bgms()):
            path.unlink(missing_ok=True)

    def _persist_order(self) -> None:
        for index in range(self.list_widget.count()):
            item = self.list_widget.item(index)
            bgm = db.get_bgm(str(item.data(Qt.ItemDataRole.UserRole)))
            if bgm is None:
                continue
            bgm.sort_order = index
            db.update_bgm(bgm)

    def _current_bgm_id(self) -> str | None:
        parent = self.window()
        current = getattr(parent, "_current_bgm_id", None)
        return str(current) if current else None

    def _retranslate_ui(self, *_args) -> None:
        self.title_label.setText(t("bgm.title"))
        self.add_button.setText(t("bgm.add"))
        self.refresh()
