from __future__ import annotations

import sys
from pathlib import Path

PRESET_COLORS = [
    "#1a6b8a",
    "#2d6a4f",
    "#6a2d5b",
    "#8a5a1a",
    "#8a1a1a",
    "#1a3d8a",
    "#4a5568",
    "#5a3e28",
]

SUPPORTED_LANGUAGES = {
    "zh": "中文",
    "en": "English",
    "id": "Bahasa Indonesia",
    "th": "ไทย",
    "vi": "Tiếng Việt",
    "es": "Español",
}

SUPPORTED_AUDIO_FORMATS = [
    "*.mp3",
    "*.wav",
    "*.ogg",
    "*.flac",
    "*.aac",
    "*.m4a",
    "*.wma",
    "*.aiff",
    "*.aif",
    "*.opus",
    "*.ape",
    "*.mp4",
    "*.webm",
]
SUPPORTED_AUDIO_EXTENSIONS = {
    ".mp3",
    ".wav",
    ".ogg",
    ".flac",
    ".aac",
    ".m4a",
    ".wma",
    ".aiff",
    ".aif",
    ".opus",
    ".ape",
    ".mp4",
    ".webm",
}
PCM_EXTENSIONS = {".wav"}
TRANSCODE_EXTENSIONS = SUPPORTED_AUDIO_EXTENSIONS - PCM_EXTENSIONS

SPEED_RANGE = (0.5, 2.0)
SPEED_STEP = 0.1

VOLUME_RANGE = (0, 100)
VOLUME_DEFAULT_SOUND = 80
VOLUME_DEFAULT_BGM = 70

CARD_WIDTH = 150
CARD_HEIGHT = 90
CARD_GAP = 12


def get_app_root() -> Path:
    """
    User data root directory (sounds_db.json / config.json / library/).
    Always points to the exe directory so data persists across restarts.
    """
    if getattr(sys, "frozen", False):
        return Path(sys.executable).parent
    return Path(sys.argv[0]).resolve().parent


def get_resource_root() -> Path:
    """
    Read-only resource root directory (i18n/ / assets/).
    In PyInstaller builds resources live under sys._MEIPASS (_internal/).
    In development mode it matches the app root.
    """
    if getattr(sys, "frozen", False):
        return Path(getattr(sys, "_MEIPASS", Path(sys.executable).parent))
    return Path(sys.argv[0]).resolve().parent


APP_ROOT = get_app_root()
RESOURCE_ROOT = get_resource_root()
DATA_DIR = APP_ROOT / "data"
LIBRARY_DIR = DATA_DIR / "library" / "sounds"
BGM_DIR = DATA_DIR / "library" / "bgm"
I18N_DIR = RESOURCE_ROOT / "i18n"
ASSETS_DIR = RESOURCE_ROOT / "assets"
ICONS_DIR = ASSETS_DIR / "icons"
STYLES_DIR = ASSETS_DIR / "styles"
FFMPEG_DIR = RESOURCE_ROOT / "assets" / "ffmpeg"
FFMPEG_EXE = FFMPEG_DIR / "ffmpeg.exe"
FFPROBE_EXE = FFMPEG_DIR / "ffprobe.exe"

CONFIG_PATH = DATA_DIR / "config.json"
SOUNDS_DB_PATH = DATA_DIR / "sounds_db.json"
BGM_DB_PATH = DATA_DIR / "bgm_db.json"

DEFAULT_CONFIG = {
    "language": "zh",
    "output_device": "default",
    "hotkey_mode": "global",
    "floating_window": {
        "visible": False,
        "x": 100,
        "y": 100,
    },
    "hotkeys": {
        "stop_all": "ctrl+shift+s",
        "bgm_play_pause": "ctrl+shift+p",
        "bgm_vol_up": "",
        "bgm_vol_down": "",
        "bgm_volume_up": "ctrl+shift+up",
        "bgm_volume_down": "ctrl+shift+down",
        "toggle_hotkey_mode": "",
        "toggle_window": "ctrl+shift+m",
        "minimize_window": "ctrl+shift+m",
        "toggle_floating": "",
    },
}


def configure_ffmpeg() -> None:
    """Configure pydub to use the embedded ffmpeg binaries when available."""
    import os
    import subprocess
    import sys as _sys
    from pydub import AudioSegment

    if FFMPEG_EXE.exists():
        AudioSegment.converter = str(FFMPEG_EXE)
        AudioSegment.ffmpeg = str(FFMPEG_EXE)
        AudioSegment.ffprobe = str(FFPROBE_EXE)
        os.environ["PATH"] = str(FFMPEG_DIR) + os.pathsep + os.environ.get("PATH", "")

    if _sys.platform == "win32" and not getattr(subprocess.Popen, "_hota_window_hidden", False):
        _original_popen_init = subprocess.Popen.__init__

        def _patched_popen_init(self, *args, **kwargs):
            si = kwargs.get("startupinfo") or subprocess.STARTUPINFO()
            si.dwFlags |= subprocess.STARTF_USESHOWWINDOW
            si.wShowWindow = subprocess.SW_HIDE
            kwargs["startupinfo"] = si
            _original_popen_init(self, *args, **kwargs)

        subprocess.Popen.__init__ = _patched_popen_init
        subprocess.Popen._hota_window_hidden = True
