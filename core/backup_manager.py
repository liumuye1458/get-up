from __future__ import annotations

import json
import shutil
import tempfile
import zipfile
from pathlib import Path

from config import DATA_DIR


class BackupManager:
    """Stateless backup manager."""

    def export_backup(self, dest_path: str) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            tmp_p = Path(tmp)
            for fname in ("config.json", "sounds_db.json", "bgm_db.json"):
                src = DATA_DIR / fname
                if src.exists():
                    shutil.copy(src, tmp_p / fname)

            lib_src = DATA_DIR / "library"
            if lib_src.exists():
                shutil.copytree(lib_src, tmp_p / "library")

            with zipfile.ZipFile(dest_path, "w", zipfile.ZIP_DEFLATED) as zf:
                for path in tmp_p.rglob("*"):
                    if path.is_file():
                        zf.write(path, path.relative_to(tmp_p))

    def validate_backup(self, zip_path: str) -> bool:
        try:
            with zipfile.ZipFile(zip_path, "r") as zf:
                names = set(zf.namelist())
            return "sounds_db.json" in names and "bgm_db.json" in names
        except Exception:
            return False

    def import_backup(
        self,
        zip_path: str,
        mode: str = "overwrite",
        progress_cb=None,
    ) -> tuple[bool, str]:
        try:
            with tempfile.TemporaryDirectory() as tmp:
                tmp_p = Path(tmp)
                with zipfile.ZipFile(zip_path, "r") as zf:
                    names = zf.namelist()
                    total = len(names)
                    for idx, name in enumerate(names):
                        zf.extract(name, tmp_p)
                        if progress_cb is not None:
                            progress_cb(idx + 1, total)

                if mode == "overwrite":
                    self._overwrite_from(tmp_p)
                else:
                    self._merge_from(tmp_p)
            return True, "ok"
        except Exception as exc:  # noqa: BLE001
            return False, str(exc)

    def _overwrite_from(self, tmp_p: Path) -> None:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        for fname in ("config.json", "sounds_db.json", "bgm_db.json"):
            src = tmp_p / fname
            if src.exists():
                shutil.copy(src, DATA_DIR / fname)

        lib_dst = DATA_DIR / "library"
        lib_src = tmp_p / "library"
        if lib_src.exists():
            if lib_dst.exists():
                shutil.rmtree(lib_dst)
            shutil.copytree(lib_src, lib_dst)

    def _merge_from(self, tmp_p: Path) -> None:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        self._merge_sounds_file(tmp_p / "sounds_db.json", DATA_DIR / "sounds_db.json")
        self._merge_bgm_file(tmp_p / "bgm_db.json", DATA_DIR / "bgm_db.json")

        lib_src = tmp_p / "library"
        lib_dst = DATA_DIR / "library"
        if lib_src.exists():
            for src_file in lib_src.rglob("*"):
                if not src_file.is_file():
                    continue
                rel = src_file.relative_to(lib_src)
                dst_file = lib_dst / rel
                dst_file.parent.mkdir(parents=True, exist_ok=True)
                if not dst_file.exists():
                    shutil.copy(src_file, dst_file)

    def _merge_sounds_file(self, src: Path, dst: Path) -> None:
        if not src.exists():
            return
        backup_payload = json.loads(src.read_text(encoding="utf-8"))
        if dst.exists():
            current_payload = json.loads(dst.read_text(encoding="utf-8"))
        else:
            current_payload = {"sounds": [], "tags": []}

        current_sounds = list(current_payload.get("sounds", []))
        current_tags = list(current_payload.get("tags", []))
        backup_sounds = list(backup_payload.get("sounds", []))
        backup_tags = list(backup_payload.get("tags", []))

        existing_sound_ids = {item.get("id") for item in current_sounds}
        existing_tag_ids = {item.get("id") for item in current_tags}

        merged = {
            "sounds": current_sounds + [
                item for item in backup_sounds if item.get("id") not in existing_sound_ids
            ],
            "tags": current_tags + [
                item for item in backup_tags if item.get("id") not in existing_tag_ids
            ],
        }
        dst.write_text(json.dumps(merged, ensure_ascii=False, indent=2), encoding="utf-8")

    def _merge_bgm_file(self, src: Path, dst: Path) -> None:
        if not src.exists():
            return
        backup_payload = json.loads(src.read_text(encoding="utf-8"))
        if dst.exists():
            current_payload = json.loads(dst.read_text(encoding="utf-8"))
        else:
            current_payload = {"bgm": []}

        current_items = list(current_payload.get("bgm", []))
        backup_items = list(backup_payload.get("bgm", []))
        existing_ids = {item.get("id") for item in current_items}
        merged = {
            "bgm": current_items + [
                item for item in backup_items if item.get("id") not in existing_ids
            ]
        }
        dst.write_text(json.dumps(merged, ensure_ascii=False, indent=2), encoding="utf-8")
