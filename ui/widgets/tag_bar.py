from __future__ import annotations

from PyQt6.QtCore import Qt, pyqtSignal
from PyQt6.QtGui import QAction
from PyQt6.QtWidgets import QHBoxLayout, QInputDialog, QMenu, QPushButton, QScrollArea, QWidget

from core.i18n_manager import I18nManager, t
from models.tag import Tag


class TagButton(QPushButton):
    rename_requested = pyqtSignal(str)
    delete_requested = pyqtSignal(str)

    def __init__(self, tag_id: str, label: str, *, show_menu: bool, parent=None) -> None:
        super().__init__(label, parent)
        self.tag_id = tag_id
        self._show_menu = show_menu
        self._base_style = ""
        self.setCheckable(True)
        self.setCursor(Qt.CursorShape.PointingHandCursor)

    def set_base_style(self, style: str) -> None:
        self._base_style = style
        self.setStyleSheet(style)

    def set_highlighted(self, highlighted: bool) -> None:
        if highlighted:
            self.setStyleSheet(
                f"{self._base_style} QPushButton {{ border: 2px solid #90caf9; border-radius: 14px; }}"
            )
        else:
            self.setStyleSheet(self._base_style)

    def contextMenuEvent(self, event) -> None:  # type: ignore[no-untyped-def]
        if not self._show_menu:
            return
        menu = QMenu(self)
        rename_action = QAction(t("tags.rename"), menu)
        rename_action.triggered.connect(lambda: self.rename_requested.emit(self.tag_id))
        delete_action = QAction(t("tags.delete"), menu)
        delete_action.triggered.connect(lambda: self.delete_requested.emit(self.tag_id))
        menu.addAction(rename_action)
        menu.addAction(delete_action)
        menu.exec(event.globalPos())


class TagBar(QScrollArea):
    tag_selected = pyqtSignal(str)
    create_requested = pyqtSignal()
    rename_requested = pyqtSignal(str)
    delete_requested = pyqtSignal(str)

    def __init__(self, parent=None) -> None:
        super().__init__(parent)
        self._current_tag = "all"
        self._tag_buttons: dict[str, TagButton] = {}

        self.setWidgetResizable(True)
        self.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
        self.setVerticalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
        self.setFrameShape(self.Shape.NoFrame)
        self.setFixedHeight(44)

        container = QWidget(self)
        self._layout = QHBoxLayout(container)
        self._layout.setContentsMargins(0, 0, 0, 0)
        self._layout.setSpacing(8)
        self.setWidget(container)

        self._all_button = TagButton("all", "", show_menu=False, parent=container)
        self._all_button.clicked.connect(lambda: self._select("all"))

        self._new_button = QPushButton(container)
        self._new_button.clicked.connect(self.create_requested.emit)

        I18nManager.events.language_changed.connect(self._retranslate_ui)
        self._retranslate_ui()

    @property
    def current_tag_id(self) -> str | int:
        return 0 if self._current_tag == "all" else self._current_tag

    def set_tags(self, tags: list[Tag], current_tag: str) -> None:
        self._current_tag = current_tag
        while self._layout.count():
            item = self._layout.takeAt(0)
            widget = item.widget()
            if widget and widget not in {self._all_button, self._new_button}:
                widget.deleteLater()

        self._tag_buttons.clear()
        self._layout.addWidget(self._all_button)
        for tag in tags:
            button = TagButton(tag.id, tag.name, show_menu=True, parent=self.widget())
            button.clicked.connect(lambda checked=False, tag_id=tag.id: self._select(tag_id))
            button.rename_requested.connect(self.rename_requested.emit)
            button.delete_requested.connect(self.delete_requested.emit)
            self._tag_buttons[tag.id] = button
            self._layout.addWidget(button)
        self._layout.addWidget(self._new_button)
        self._layout.addStretch(1)
        self._apply_selection()
        self._retranslate_ui()

    def prompt_new_tag(self) -> str | None:
        value, accepted = QInputDialog.getText(self, t("app.title"), t("sounds.add_tag"))
        if not accepted:
            return None
        return value.strip() or None

    def prompt_rename_tag(self, current_name: str) -> str | None:
        value, accepted = QInputDialog.getText(self, t("app.title"), t("tags.rename_prompt"), text=current_name)
        if not accepted:
            return None
        return value.strip() or None

    def _select(self, tag_id: str) -> None:
        self._current_tag = tag_id
        self._apply_selection()
        self.tag_selected.emit(tag_id)

    def _apply_selection(self) -> None:
        self._all_button.setChecked(self._current_tag == "all")
        self._all_button.set_base_style(self._style_for(self._current_tag == "all"))
        for tag_id, button in self._tag_buttons.items():
            button.setChecked(self._current_tag == tag_id)
            button.set_base_style(self._style_for(self._current_tag == tag_id))

    def _style_for(self, checked: bool) -> str:
        background = "#1a6b8a" if checked else "#252540"
        color = "white" if checked else "#888899"
        hover = "#2a2a50"
        return (
            "QPushButton {"
            f"background: {background}; color: {color}; border-radius: 14px; padding: 6px 12px; border: none;"
            "}"
            f"QPushButton:hover {{ background: {hover}; color: white; }}"
        )

    def _retranslate_ui(self, *_args) -> None:
        self._all_button.setText(t("sounds.tag.all"))
        self._new_button.setText(t("sounds.add_tag"))
        self._apply_selection()
