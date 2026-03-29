from __future__ import annotations

import logging
import threading
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PyQt6.QtCore import QObject, pyqtSignal
import scipy.signal
import sounddevice as sd
import soundfile as sf

from models.sound_effect import SoundEffect


@dataclass(slots=True)
class ActiveSound:
    sound_id: str
    data: np.ndarray
    loop: bool = False
    position: int = 0

    def read(self, frames: int) -> np.ndarray | None:
        if len(self.data) == 0:
            return None
        chunks: list[np.ndarray] = []
        remaining = frames

        while remaining > 0:
            if self.position >= len(self.data):
                if not self.loop:
                    break
                self.position = 0

            end = min(self.position + remaining, len(self.data))
            chunk = self.data[self.position:end]
            if len(chunk) == 0:
                break
            chunks.append(chunk)
            read_frames = len(chunk)
            self.position += read_frames
            remaining -= read_frames

            if self.position >= len(self.data) and not self.loop:
                break

        if not chunks:
            return None
        if len(chunks) == 1:
            return chunks[0]
        return np.concatenate(chunks, axis=0)

    def reset(self) -> None:
        self.position = 0


class AudioEngine(QObject):
    device_error = pyqtSignal(str)
    status_message = pyqtSignal(str)

    def __init__(self) -> None:
        super().__init__()
        self._stream: sd.OutputStream | None = None
        self._active_sounds: list[ActiveSound] = []
        self._lock = threading.Lock()
        self._output_device: int | None = None
        self._samplerate = 44100
        self._available = False
        self.device_error.connect(self.status_message.emit)
        self._init_stream()

    def _init_stream(self) -> None:
        self.cleanup()
        try:
            self._stream = sd.OutputStream(
                samplerate=self._samplerate,
                channels=2,
                dtype="float32",
                device=self._output_device,
                callback=self._audio_callback,
                blocksize=4096,
                latency="high",
            )
            self._stream.start()
            self._available = True
        except Exception as exc:  # noqa: BLE001
            self._stream = None
            self._available = False
            self.status_message.emit(str(exc))

    def cleanup(self) -> None:
        if self._stream is None:
            return
        try:
            self._stream.stop()
            self._stream.close()
        except Exception:  # noqa: BLE001
            pass
        self._stream = None

    def is_available(self) -> bool:
        return self._available

    def _audio_callback(self, outdata, frames, _time, status) -> None:  # type: ignore[no-untyped-def]
        if status:
            if getattr(status, "output_underflow", False):
                logging.debug("[AudioEngine] output underflow")
            else:
                self.device_error.emit(str(status))
        mixed = np.zeros((frames, 2), dtype=np.float32)
        with self._lock:
            finished: list[ActiveSound] = []
            for sound in self._active_sounds:
                chunk = sound.read(frames)
                if chunk is None:
                    finished.append(sound)
                    continue
                mixed[: len(chunk)] += chunk
            for sound in finished:
                if sound in self._active_sounds:
                    self._active_sounds.remove(sound)
        np.clip(mixed, -1.0, 1.0, out=mixed)
        outdata[:] = mixed

    def play_sound(self, sound: SoundEffect) -> None:
        if not sound.enabled:
            return
        pcm = self._load_pcm(sound)
        if pcm.size == 0:
            return
        with self._lock:
            self._active_sounds.clear()
            self._active_sounds.append(ActiveSound(sound.id, pcm, loop=sound.loop))

    def stop_all(self) -> None:
        with self._lock:
            self._active_sounds.clear()

    def set_output_device(self, device: str | int) -> None:
        self._output_device = None if device == "default" else int(device)
        self._init_stream()

    def _load_pcm(self, sound: SoundEffect) -> np.ndarray:
        path = Path(sound.library_path)
        data, samplerate = sf.read(path, dtype="float32", always_2d=True)
        if data.size == 0:
            return np.zeros((0, 2), dtype=np.float32)

        start_frame = max(0, int(sound.trim_start * samplerate))
        end_frame = int(sound.trim_end * samplerate) if sound.trim_end else len(data)
        end_frame = max(start_frame, min(end_frame, len(data)))
        data = data[start_frame:end_frame]

        if data.shape[1] == 1:
            data = np.repeat(data, 2, axis=1)
        elif data.shape[1] > 2:
            data = data[:, :2]

        if samplerate != self._samplerate:
            target_length = int(len(data) * self._samplerate / samplerate)
            if target_length > 0:
                data = scipy.signal.resample(data, target_length, axis=0)
            samplerate = self._samplerate

        if sound.speed != 1.0 and len(data) > 0:
            data = self._apply_speed(data, self._samplerate, sound.speed)

        data = data.astype(np.float32, copy=False)
        data *= sound.volume / 100.0

        if sound.fade_in and len(data) > 0:
            fade_frames = min(int(sound.fade_in_duration * samplerate), len(data))
            if fade_frames > 0:
                envelope = np.linspace(0.0, 1.0, fade_frames, dtype=np.float32)
                data[:fade_frames] *= envelope[:, np.newaxis]
        return data

    def _apply_speed(self, data: np.ndarray, sr: int, speed: float) -> np.ndarray:
        """
        Use scipy.signal.resample for speed changes.
        audiostretchy is disabled because it crashes natively on Python 3.12.
        """
        if speed == 1.0:
            return data
        target_len = int(len(data) / speed)
        if target_len <= 0:
            return data
        return scipy.signal.resample(data, target_len, axis=0).astype(np.float32, copy=False)

    @staticmethod
    def list_output_devices() -> list[dict[str, int | str]]:
        result: list[dict[str, int | str]] = [{"index": -1, "name": "系统默认"}]

        try:
            host_apis = sd.query_hostapis()
            wasapi_index = next(
                (
                    index
                    for index, api in enumerate(host_apis)
                    if "WASAPI" in str(api.get("name", ""))
                ),
                None,
            )
        except Exception:
            wasapi_index = None

        seen: set[str] = set()
        for index, device in enumerate(sd.query_devices()):
            if int(device["max_output_channels"]) < 1:
                continue
            if wasapi_index is not None and int(device.get("hostapi", -1)) != wasapi_index:
                continue
            name = str(device["name"]).strip()
            if name in seen:
                continue
            seen.add(name)
            result.append({"index": index, "name": name})
        return result


class BGMPlayer:
    _instance = None

    @classmethod
    def instance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def __init__(self):
        self._stream = None
        self._data: np.ndarray | None = None
        self._pos = 0
        self._volume = 0.7
        self._loop = True
        self._paused = False
        self._lock = threading.Lock()
        self._sr = 44100
        self._total_frames = 0
        self.position_cb = None

    def play(self, path: str, volume: int = 70, loop: bool = True):
        self.stop()
        data, sr = sf.read(path, dtype="float32", always_2d=True)
        if data.shape[1] == 1:
            data = np.repeat(data, 2, axis=1)
        elif data.shape[1] > 2:
            data = data[:, :2]
        with self._lock:
            self._data = data
            self._pos = 0
            self._sr = sr
            self._total_frames = len(data)
            self._volume = volume / 100.0
            self._loop = loop
            self._paused = False
        self._stream = sd.OutputStream(
            samplerate=sr,
            channels=2,
            dtype="float32",
            device=audio_engine._output_device,
            callback=self._callback,
            blocksize=4096,
            latency="high",
        )
        self._stream.start()

    def _callback(self, outdata, frames, _time, _status):
        with self._lock:
            if self._data is None or self._paused:
                outdata[:] = 0
                return
            end = self._pos + frames
            chunk = self._data[self._pos:end]
            if len(chunk) < frames:
                if self._loop:
                    rest = frames - len(chunk)
                    self._pos = min(rest, self._total_frames)
                    chunk2 = self._data[0 : self._pos]
                    chunk = np.concatenate([chunk, chunk2], axis=0)
                else:
                    pad = np.zeros((frames - len(chunk), 2), dtype="float32")
                    chunk = np.concatenate([chunk, pad], axis=0)
                    self._data = None
                    self._pos = 0
            else:
                self._pos = end
            outdata[:] = chunk * self._volume
            if self.position_cb and self._total_frames > 0:
                try:
                    self.position_cb(self._pos / self._sr, self._total_frames / self._sr)
                except Exception:
                    pass

    def pause(self):
        with self._lock:
            self._paused = True

    def resume(self):
        with self._lock:
            self._paused = False

    def stop(self):
        if self._stream:
            try:
                self._stream.stop()
                self._stream.close()
            except Exception:
                pass
            self._stream = None
        with self._lock:
            self._data = None
            self._pos = 0
            self._paused = False

    @property
    def is_playing(self) -> bool:
        with self._lock:
            return self._data is not None and not self._paused

    @property
    def is_paused(self) -> bool:
        with self._lock:
            return self._paused

    def set_volume(self, vol: int):
        with self._lock:
            self._volume = vol / 100.0

    def set_loop(self, loop: bool):
        with self._lock:
            self._loop = loop


audio_engine = AudioEngine()
bgm_player = BGMPlayer.instance()
