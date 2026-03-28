block_cipher = None

a = Analysis(
    ["main.py"],
    pathex=["."],
    binaries=[
        ("assets/ffmpeg/ffmpeg.exe", "assets/ffmpeg"),
        ("assets/ffmpeg/ffprobe.exe", "assets/ffmpeg"),
    ],
    datas=[
        ("i18n", "i18n"),
        ("assets", "assets"),
    ],
    hiddenimports=[
        "sounddevice",
        "soundfile",
        "numpy",
        "scipy",
        "scipy.signal",
        "pyqtgraph",
        "keyboard",
        "pydub",
    ],
    hookspath=[],
    runtime_hooks=[],
    excludes=[],
    cipher=block_cipher,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="HOTA音效板",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=False,
    icon="assets/icons/app.png",
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=False,
    name="HOTA音效板",
)
