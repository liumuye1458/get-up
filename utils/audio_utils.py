from __future__ import annotations

import shutil
from pathlib import Path

from pydub import AudioSegment
import numpy as np
import soundfile as sf

from config import FFMPEG_EXE, PCM_EXTENSIONS
from utils.file_utils import unique_path


def check_ffmpeg() -> bool:
    return FFMPEG_EXE.exists() or shutil.which("ffmpeg") is not None


def import_audio_file(source_path: str | Path, target_dir: Path) -> Path:
    source = Path(source_path)
    suffix = source.suffix.lower()
    target = unique_path(target_dir, f"{source.stem}.wav")
    if suffix == ".wav":
        shutil.copy(source, target)
        return target

    if not check_ffmpeg():
        raise RuntimeError("ffmpeg_not_found")

    audio = AudioSegment.from_file(source)
    audio.export(target, format="wav")
    return target


def read_audio_duration(path: str | Path) -> float:
    info = sf.info(str(path))
    return float(info.frames) / float(info.samplerate)


def downsample_waveform(samples: np.ndarray, target_points: int) -> np.ndarray:
    if samples.size <= target_points:
        return samples
    chunk = max(1, samples.size // target_points)
    return np.array(
        [samples[index : index + chunk].max() for index in range(0, samples.size, chunk)],
        dtype=np.float32,
    )[:target_points]
