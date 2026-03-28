import io
import sys

# Force UTF-8 stdio on Windows consoles to avoid UnicodeEncodeError.
if sys.stdout and hasattr(sys.stdout, "buffer"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
if sys.stderr and hasattr(sys.stderr, "buffer"):
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

from PyQt6.QtCore import QTimer
from PyQt6.QtGui import QFont, QIcon
from PyQt6.QtWidgets import QApplication

from config import ASSETS_DIR, DATA_DIR, ICONS_DIR, STYLES_DIR, configure_ffmpeg
from core.i18n_manager import I18nManager
from ui.dialogs.welcome_dialog import WelcomeDialog
FIRST_RUN = not DATA_DIR.exists()

from models.db import db
from ui.main_window import MainWindow


configure_ffmpeg()


def main() -> int:
    app = QApplication(sys.argv)
    app.setFont(QFont("Microsoft YaHei", 10))

    icon_path = ICONS_DIR / "app.svg"
    if icon_path.exists():
        app.setWindowIcon(QIcon(str(icon_path)))

    style_path = STYLES_DIR / "main.qss"
    if style_path.exists():
        app.setStyleSheet(style_path.read_text(encoding="utf-8"))
    qss_path = ASSETS_DIR / "style.qss"
    if qss_path.exists():
        app.setStyleSheet(app.styleSheet() + "\n" + qss_path.read_text(encoding="utf-8"))

    I18nManager.load(str(db.config().get("language", "zh")))

    window = MainWindow()
    window.show()

    def _show_welcome_if_first_run() -> None:
        if FIRST_RUN:
            WelcomeDialog(window).exec()

    QTimer.singleShot(100, _show_welcome_if_first_run)
    return app.exec()


if __name__ == "__main__":
    raise SystemExit(main())
