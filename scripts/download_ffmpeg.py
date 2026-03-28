import urllib.request
import zipfile
from pathlib import Path

URL = "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip"
ZIP = Path("ffmpeg_tmp.zip")
OUT = Path("assets/ffmpeg")

print("下载中...")
urllib.request.urlretrieve(URL, ZIP)
print("解压中...")
with zipfile.ZipFile(ZIP) as archive:
    for name in archive.namelist():
        if name.endswith("ffmpeg.exe") or name.endswith("ffprobe.exe"):
            data = archive.read(name)
            OUT.mkdir(parents=True, exist_ok=True)
            (OUT / Path(name).name).write_bytes(data)
            print(f"  解压: {Path(name).name}")
ZIP.unlink()
print("完成：", list(OUT.iterdir()))
