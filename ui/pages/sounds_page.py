from __future__ import annotations

import os
from pathlib import Path

from PyQt6.QtCore import Qt, pyqtSignal
from PyQt6.QtWidgets import (
    QApplication,
    QFileDialog,
    QHBoxLayout,
    QMessageBox,
    QProgressDialog,
    QPushButton,
    QVBoxLayout,
    QWidget,
)

from config import LIBRARY_DIR, PRESET_COLORS, SUPPORTED_AUDIO_FORMATS
from core.i18n_manager import I18nManager, t
from models.db import db
from models.sound_effect import SoundEffect
from ui.widgets.search_bar import SearchBar
from ui.widgets.sound_card_grid import SoundCardGrid
from ui.widgets.tag_bar import TagBar
from utils.audio_utils import import_audio_file

FILE_DIALOG_AUDIO_FILTER = "Audio Files (*.mp3 *.wav *.ogg *.flac *.wma *.aac *.aiff *.opus);;All Files (*)"


class SoundsPage(QWidget):
    play_requested = pyqtSignal(str)
    replace_requested = pyqtSignal(str)
    edit_requested = pyqtSignal(str)
    clip_requested = pyqtSignal(str)
    duplicate_requested = pyqtSignal(str)
    delete_requested = pyqtSignal(str)
    hotkey_requested = pyqtSignal(str)
    clear_hotkey_requested = pyqtSignal(str)
    status_message = pyqtSignal(str)

    def __init__(self, parent=None) -> None:
        super().__init__(parent)
        self._search_query = ""
        self._current_tag = "all"
        self.setAcceptDrops(True)

        layout = QVBoxLayout(self)
        layout.setContentsMargins(16, 16, 16, 16)
        layout.setSpacing(12)

        self.search_bar = SearchBar(self)
        self.search_bar.query_changed.connect(self._set_query)

        self.import_button = QPushButton(self)
        self.import_button.setFixedWidth(120)
        self.import_button.setFixedHeight(36)
        self.import_button.clicked.connect(self.import_sounds)

        top_row = QHBoxLayout()
        top_row.setContentsMargins(0, 0, 0, 0)
        top_row.setSpacing(12)
        top_row.addWidget(self.search_bar, 1)
        top_row.addWidget(self.import_button, 0)
        layout.addLayout(top_row)

        self.tag_bar = TagBar(self)
        self.tag_bar.tag_selected.connect(self._set_tag)
        self.tag_bar.create_requested.connect(self._create_tag)
        self.tag_bar.rename_requested.connect(self._rename_tag)
        self.tag_bar.delete_requested.connect(self._delete_tag)
        layout.addWidget(self.tag_bar)

        self.grid = SoundCardGrid(self)
        layout.addWidget(self.grid, 1)

        db.sounds_changed.connect(self.reload)
        db.tag_changed.connect(self.reload)
        I18nManager.events.language_changed.connect(self._retranslate_ui)
        self._retranslate_ui()
        self.reload()

    def reload(self) -> None:
        sounds = db.all_sounds()
        tags = db.all_tags()
        self.tag_bar.set_tags(tags, self._current_tag)

        if self._current_tag != "all":
            sounds = [sound for sound in sounds if self._current_tag in sound.tags]

        query = self._search_query.strip().lower()
        if query:
            tags_by_id = {tag.id: tag.name.lower() for tag in db.all_tags()}
            sounds = [
                sound
                for sound in sounds
                if query in sound.name.lower()
                or query in sound.hotkey.lower()
                or any(query in tags_by_id.get(tag_id, "") for tag_id in sound.tags)
            ]
        self.grid.set_sounds(
            sounds,
            tags=tags,
            current_tag=self._current_tag,
            drag_enabled=not bool(query),
            on_play=self.play_requested.emit,
            on_replace=self.replace_requested.emit,
            on_edit=self.edit_requested.emit,
            on_clip=self.clip_requested.emit,
            on_duplicate=self.duplicate_requested.emit,
            on_delete=self.delete_requested.emit,
            on_set_hotkey=self.hotkey_requested.emit,
            on_clear_hotkey=self.clear_hotkey_requested.emit,
            on_toggle_tag=self._toggle_sound_tag,
            on_remove_current_tag=self._remove_from_current_tag,
            on_move=self._move_sound,
        )

    def refresh(self) -> None:
        self.reload()

        files, _ = QFileDialog.getOpenFileNames(
            self,
            t("common.select_audio_files"),
            "",
            FILE_DIALOG_AUDIO_FILTER,
        )
        self._import_files(files)

    def import_sounds(self) -> None:
        self.refresh()

    def _import_files(self, files: list[str]) -> list[str]:
        if not files:
            return []

        current_tag_id = self.tag_bar.current_tag_id
        assign_tag_id = None if current_tag_id in (None, 0, "all") else str(current_tag_id)

        progress = QProgressDialog(t("sounds.import_progress"), t("common.cancel"), 0, len(files), self)
        progress.setWindowTitle(t("common.importing"))
        progress.setWindowModality(Qt.WindowModality.WindowModal)
        progress.setMinimumDuration(0)
        progress.setValue(0)

        imported_ids: list[str] = []
        failed = 0
        for index, file_path in enumerate(files):
            if progress.wasCanceled():
                break

            progress.setLabelText(
                t("sounds.import_progress_item", current=index + 1, total=len(files), name=os.path.basename(file_path))
            )
            progress.setValue(index)
            QApplication.processEvents()

            try:
                sound = self._import_single_file(file_path, offset=len(imported_ids))
                if assign_tag_id is not None:
                    db.set_sound_tags(sound.id, [assign_tag_id])
                imported_ids.append(sound.id)
            except Exception as exc:  # noqa: BLE001
                failed += 1
                self.status_message.emit(f"{t('sounds.import.failed', name=Path(file_path).name)} ({exc})")

        progress.setValue(len(files))
        progress.close()

        if failed:
            QMessageBox.warning(
                self,
                t("app.title"),
                t("sounds.import.partial", success=len(imported_ids), failed=failed),
            )
        self.reload()
        return imported_ids

    def _import_single_file(self, file_path: str, *, offset: int = 0) -> SoundEffect:
        source = Path(file_path)
        stored = import_audio_file(source, LIBRARY_DIR)
        sound = SoundEffect.create(
            name=source.stem,
            original_filename=source.name,
            library_path=str(stored),
            color=PRESET_COLORS[(db.count() + offset) % len(PRESET_COLORS)],
            sort_order=db.next_sound_sort_order() + offset,
        )
        db.add_sounds([sound])
        return sound

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
            self._import_files([str(path) for path in unique_files])
            self.reload()
        event.acceptProposedAction()

    def _set_query(self, query: str) -> None:
        self._search_query = query
        self.reload()

    def _set_tag(self, tag_id: str) -> None:
        self._current_tag = tag_id
        self.reload()

    def _create_tag(self) -> None:
        name = self.tag_bar.prompt_new_tag()
        if not name:
            return
        tag = db.add_tag(name)
        if tag is not None:
            self._current_tag = tag.id
            self.reload()

    def _rename_tag(self, tag_id: str) -> None:
        tag = db.get_tag(tag_id)
        if tag is None:
            return
        name = self.tag_bar.prompt_rename_tag(tag.name)
        if not name:
            return
        db.rename_tag(tag_id, name)

    def _delete_tag(self, tag_id: str) -> None:
        tag = db.get_tag(tag_id)
        if tag is None:
            return
        confirmed = QMessageBox.question(
            self,
            t("app.title"),
            t("tags.delete_confirm", name=tag.name),
        )
        if confirmed != QMessageBox.StandardButton.Yes:
            return
        db.delete_tag(tag_id)
        if self._current_tag == tag_id:
            self._current_tag = "all"
        self.reload()

    def _toggle_sound_tag(self, sound_id: str, tag_id: str) -> None:
        if db.toggle_sound_tag(sound_id, tag_id):
            self.reload()

    def _remove_from_current_tag(self, sound_id: str, tag_id: str) -> None:
        if db.remove_sound_tag(sound_id, tag_id):
            self.reload()

    def _move_sound(self, source_id: str, target_id: str) -> None:
        if self._search_query.strip():
            return
        if db.move_sound_before(source_id, target_id):
            self.reload()

    def _retranslate_ui(self, *_args) -> None:
        self.import_button.setText(t("sounds.import"))
