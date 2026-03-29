from __future__ import annotations

from datetime import datetime

from PyQt6.QtWidgets import (
    QDialog,
    QDialogButtonBox,
    QFileDialog,
    QFrame,
    QLabel,
    QMessageBox,
    QPushButton,
    QRadioButton,
    QVBoxLayout,
    QWidget,
)

from core.backup_manager import BackupManager
from core.i18n_manager import I18nManager, t
from models.db import db

BACKUP_FILE_FILTER = "Backup Files (*.zip);;All Files (*)"


class BackupPage(QWidget):
    def __init__(self, main_window=None, parent=None) -> None:
        super().__init__(parent)
        self._main_window = main_window
        self._backup_manager = BackupManager()
        self._setup_ui()
        I18nManager.events.language_changed.connect(self._retranslate_ui)
        self._retranslate_ui()

    def _setup_ui(self) -> None:
        layout = QVBoxLayout(self)
        layout.setContentsMargins(32, 32, 32, 32)
        layout.setSpacing(20)

        self._title = QLabel(self)
        self._title.setStyleSheet("font-size: 18px; font-weight: bold;")
        layout.addWidget(self._title)

        self._desc = QLabel(self)
        self._desc.setStyleSheet("color: #888899;")
        self._desc.setWordWrap(True)
        layout.addWidget(self._desc)

        sep = QFrame(self)
        sep.setFrameShape(QFrame.Shape.HLine)
        sep.setStyleSheet("color: #333344;")
        layout.addWidget(sep)

        self._export_label = QLabel(self)
        self._export_label.setStyleSheet("font-size: 14px; font-weight: bold;")
        layout.addWidget(self._export_label)

        self._export_desc = QLabel(self)
        self._export_desc.setStyleSheet("color: #888899;")
        self._export_desc.setWordWrap(True)
        layout.addWidget(self._export_desc)

        self.export_button = QPushButton(self)
        self.export_button.setFixedWidth(160)
        self.export_button.clicked.connect(self._on_export)
        layout.addWidget(self.export_button)

        sep2 = QFrame(self)
        sep2.setFrameShape(QFrame.Shape.HLine)
        sep2.setStyleSheet("color: #333344;")
        layout.addWidget(sep2)

        self._import_label = QLabel(self)
        self._import_label.setStyleSheet("font-size: 14px; font-weight: bold;")
        layout.addWidget(self._import_label)

        self._import_desc = QLabel(self)
        self._import_desc.setStyleSheet("color: #888899;")
        self._import_desc.setWordWrap(True)
        layout.addWidget(self._import_desc)

        self.import_button = QPushButton(self)
        self.import_button.setFixedWidth(160)
        self.import_button.clicked.connect(self._on_import)
        layout.addWidget(self.import_button)

        layout.addStretch(1)

    def _on_export(self) -> None:
        default_name = f"soundboard_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.zip"
        path, _ = QFileDialog.getSaveFileName(
            self,
            t("backup.export_button"),
            default_name,
            BACKUP_FILE_FILTER,
        )
        if not path:
            return
        if self._main_window is not None and hasattr(self._main_window, "_do_export_backup"):
            self._main_window._do_export_backup(path)
            return

        ok, message = self._backup_manager.export_backup(path)
        if ok:
            QMessageBox.information(
                self,
                t("backup.export_success_title"),
                t("backup.export_success_message", path=path),
            )
            return
        QMessageBox.critical(self, t("backup.export_fail_title"), message)

    def _on_import(self) -> None:
        path, _ = QFileDialog.getOpenFileName(
            self,
            t("backup.import_select_title"),
            "",
            BACKUP_FILE_FILTER,
        )
        if not path:
            return
        if not self._backup_manager.validate_backup(path):
            QMessageBox.warning(self, t("backup.invalid_title"), t("backup.invalid_message"))
            return

        dialog = _ImportModeDialog(self)
        if dialog.exec() != QDialog.DialogCode.Accepted:
            return

        if self._main_window is not None and hasattr(self._main_window, "_do_import_backup"):
            self._main_window._do_import_backup(path, dialog.selected_mode())
            return

        ok, message = self._backup_manager.import_backup(path, dialog.selected_mode())
        if not ok:
            QMessageBox.critical(self, t("backup.import_fail_title"), message)
            return
        db.load()
        QMessageBox.information(self, t("backup.import_success_title"), t("backup.import_success_message"))

    def _retranslate_ui(self, *_args) -> None:
        self._title.setText(t("backup.title"))
        self._desc.setText(t("backup.desc"))
        self._export_label.setText(t("backup.export_section"))
        self._export_desc.setText(t("backup.export_desc"))
        self.export_button.setText(t("backup.export_button"))
        self._import_label.setText(t("backup.import_section"))
        self._import_desc.setText(t("backup.import_desc"))
        self.import_button.setText(t("backup.import_button"))


class _ImportModeDialog(QDialog):
    def __init__(self, parent=None) -> None:
        super().__init__(parent)
        self.setFixedSize(320, 180)

        layout = QVBoxLayout(self)
        layout.setSpacing(12)

        self._prompt = QLabel(self)
        layout.addWidget(self._prompt)

        self._rb_overwrite = QRadioButton(self)
        self._rb_merge = QRadioButton(self)
        self._rb_overwrite.setChecked(True)
        layout.addWidget(self._rb_overwrite)
        layout.addWidget(self._rb_merge)

        buttons = QDialogButtonBox(
            QDialogButtonBox.StandardButton.Ok | QDialogButtonBox.StandardButton.Cancel,
            parent=self,
        )
        buttons.accepted.connect(self.accept)
        buttons.rejected.connect(self.reject)
        layout.addWidget(buttons)

        self._retranslate_ui()

    def selected_mode(self) -> str:
        return "overwrite" if self._rb_overwrite.isChecked() else "merge"

    def _retranslate_ui(self) -> None:
        self.setWindowTitle(t("backup.import_mode_title"))
        self._prompt.setText(t("backup.import_mode_prompt"))
        self._rb_overwrite.setText(t("backup.import_mode_overwrite"))
        self._rb_merge.setText(t("backup.import_mode_merge"))
