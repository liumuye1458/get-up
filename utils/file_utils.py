from __future__ import annotations

import shutil
from pathlib import Path


def unique_path(directory: Path, filename: str) -> Path:
    directory.mkdir(parents=True, exist_ok=True)
    candidate = directory / filename
    stem = candidate.stem
    suffix = candidate.suffix
    counter = 1
    while candidate.exists():
        candidate = directory / f"{stem}_{counter}{suffix}"
        counter += 1
    return candidate


def copy_with_unique_name(source: Path, target_dir: Path, target_name: str | None = None) -> Path:
    filename = target_name or source.name
    destination = unique_path(target_dir, filename)
    shutil.copy2(source, destination)
    return destination
