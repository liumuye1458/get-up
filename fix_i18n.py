"""
以 en.json 为基准，将所有缺失 key 用英文值自动填充到其他语言文件。
"""

from __future__ import annotations

import json
import os
from pathlib import Path


I18N_DIR = Path(__file__).resolve().parent / "i18n"
BASE_FILE = I18N_DIR / "en.json"


def flatten(data: dict, prefix: str = "") -> dict[str, object]:
    items: dict[str, object] = {}
    for key, value in data.items():
        full_key = f"{prefix}.{key}" if prefix else key
        if isinstance(value, dict):
            items.update(flatten(value, full_key))
        else:
            items[full_key] = value
    return items


def merge_missing(base: object, current: object) -> object:
    if isinstance(base, dict) and isinstance(current, dict):
        merged = dict(current)
        for key, value in base.items():
            if key in merged:
                merged[key] = merge_missing(value, merged[key])
            else:
                merged[key] = value
        return merged
    return current


def main() -> None:
    with BASE_FILE.open("r", encoding="utf-8-sig") as handle:
        base = json.load(handle)

    for filename in os.listdir(I18N_DIR):
        if not filename.endswith(".json") or filename == "en.json":
            continue

        path = I18N_DIR / filename
        with path.open("r", encoding="utf-8-sig") as handle:
            lang = json.load(handle)

        base_flat = flatten(base)
        lang_flat = flatten(lang)
        missing = set(base_flat.keys()) - set(lang_flat.keys())

        if missing:
            print(f"\n{filename}: {len(missing)} missing keys")
            for key in sorted(missing):
                print(f"  + {key}")
            result = merge_missing(base, lang)
            with path.open("w", encoding="utf-8") as handle:
                json.dump(result, handle, ensure_ascii=False, indent=2)
            print(f"  -> {filename} updated")
        else:
            print(f"{filename}: OK")

    print("\nDone. Re-check zh.json manually for Chinese-specific values.")


if __name__ == "__main__":
    main()
