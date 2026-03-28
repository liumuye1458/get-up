from __future__ import annotations

from PyQt6.QtCore import QPoint, QRect, QSize, Qt
from PyQt6.QtWidgets import QLayout, QLayoutItem, QSizePolicy, QStyle, QWidget


class FlowLayout(QLayout):
    def __init__(
        self,
        parent: QWidget | None = None,
        margin: int = 0,
        h_spacing: int = -1,
        v_spacing: int = -1,
    ) -> None:
        super().__init__(parent)
        self._items: list[QLayoutItem] = []
        self._h_spacing = h_spacing
        self._v_spacing = v_spacing
        self.setContentsMargins(margin, margin, margin, margin)

    def __del__(self) -> None:
        while self.count():
            self.takeAt(0)

    def addItem(self, item: QLayoutItem) -> None:
        self._items.append(item)

    def count(self) -> int:
        return len(self._items)

    def itemAt(self, index: int) -> QLayoutItem | None:
        if 0 <= index < len(self._items):
            return self._items[index]
        return None

    def takeAt(self, index: int) -> QLayoutItem | None:
        if 0 <= index < len(self._items):
            return self._items.pop(index)
        return None

    def clear(self) -> None:
        while self.count():
            item = self.takeAt(0)
            if item and item.widget():
                item.widget().deleteLater()

    def expandingDirections(self) -> Qt.Orientations:
        return Qt.Orientation(0)

    def hasHeightForWidth(self) -> bool:
        return True

    def heightForWidth(self, width: int) -> int:
        return self._do_layout(QRect(0, 0, width, 0), True)

    def setGeometry(self, rect: QRect) -> None:
        super().setGeometry(rect)
        self._do_layout(rect, False)

    def sizeHint(self) -> QSize:
        return self.minimumSize()

    def minimumSize(self) -> QSize:
        size = QSize()
        for item in self._items:
            size = size.expandedTo(item.minimumSize())
        margins = self.contentsMargins()
        size += QSize(margins.left() + margins.right(), margins.top() + margins.bottom())
        return size

    def horizontalSpacing(self) -> int:
        return self._h_spacing if self._h_spacing >= 0 else self._smart_spacing(QStyle.PixelMetric.PM_LayoutHorizontalSpacing)

    def verticalSpacing(self) -> int:
        return self._v_spacing if self._v_spacing >= 0 else self._smart_spacing(QStyle.PixelMetric.PM_LayoutVerticalSpacing)

    def _do_layout(self, rect: QRect, test_only: bool) -> int:
        x = rect.x()
        y = rect.y()
        line_height = 0
        spacing_x = self.horizontalSpacing()
        spacing_y = self.verticalSpacing()

        for item in self._items:
            widget = item.widget()
            style = widget.style() if widget else None
            next_x = x + item.sizeHint().width() + spacing_x
            if next_x - spacing_x > rect.right() and line_height > 0:
                x = rect.x()
                y += line_height + spacing_y
                next_x = x + item.sizeHint().width() + spacing_x
                line_height = 0

            if not test_only:
                item.setGeometry(QRect(QPoint(x, y), item.sizeHint()))

            x = next_x
            line_height = max(line_height, item.sizeHint().height())

            if style:
                spacing_x = max(spacing_x, style.layoutSpacing(
                    QSizePolicy.ControlType.PushButton,
                    QSizePolicy.ControlType.PushButton,
                    Qt.Orientation.Horizontal,
                ))
                spacing_y = max(spacing_y, style.layoutSpacing(
                    QSizePolicy.ControlType.PushButton,
                    QSizePolicy.ControlType.PushButton,
                    Qt.Orientation.Vertical,
                ))

        return y + line_height - rect.y()

    def _smart_spacing(self, pixel_metric: QStyle.PixelMetric) -> int:
        parent = self.parent()
        if parent is None:
            return -1
        if isinstance(parent, QWidget):
            return parent.style().pixelMetric(pixel_metric, None, parent)
        return parent.spacing()
