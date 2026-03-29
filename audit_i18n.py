"""
audit_i18n.py - audit i18n keys used in code and coverage in language files.
"""
from __future__ import annotations

import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parent
I18N_DIR = ROOT / "i18n"
SKIP_DIRS = {"build", "dist", "data", ".git", "__pycache__"}
PATTERNS = (
    re.compile(r'(?<![A-Za-z0-9_])t\(["\']([A-Za-z0-9_.]+)["\']'),
    re.compile(r'\.t\(["\']([A-Za-z0-9_.]+)["\']'),
)


def collect_code_keys() -> set[str]:
    keys: set[str] = set()
    for path in ROOT.rglob("*.py"):
        if any(part in SKIP_DIRS for part in path.parts):
            continue
        text = path.read_text(encoding="utf-8")
        for pattern in PATTERNS:
            keys.update(key for key in pattern.findall(text) if not key.endswith("."))
    return keys


def flatten(data: dict) -> dict[str, str]:
    flat: dict[str, str] = {}
    for key, value in data.items():
        if isinstance(value, dict):
            for child_key, child_value in flatten(value).items():
                flat[f"{key}.{child_key}"] = child_value
        else:
            flat[key] = value
    return flat


def main() -> None:
    code_keys = collect_code_keys()
    print(f"Found {len(code_keys)} unique i18n keys in code:\n")
    for key in sorted(code_keys):
        print(f"  {key}")

    en_data = json.loads((I18N_DIR / "en.json").read_text(encoding="utf-8-sig"))
    en_flat = flatten(en_data)

    print("\n--- Keys in code but NOT in en.json ---")
    missing_in_en = [key for key in sorted(code_keys) if key not in en_flat]
    if missing_in_en:
        for key in missing_in_en:
            print(f"  MISSING: {key}")
    else:
        print("  None")

    print("\n--- Language file audit ---")
    for path in sorted(I18N_DIR.glob("*.json")):
        data = json.loads(path.read_text(encoding="utf-8-sig"))
        flat = flatten(data)
        missing = sorted(set(en_flat) - set(flat))
        same_as_en: list[str] = []
        if path.name != "en.json":
            for key, value in flat.items():
                if key in en_flat and value == en_flat[key] and en_flat[key] != "HOTA SoundPad":
                    same_as_en.append(key)

        print(f"\n{path.name}: {len(flat)} keys")
        if missing:
            print(f"  Missing {len(missing)} keys:")
            for key in missing:
                print(f"    - {key}")
        else:
            print("  Missing 0 keys")
        if path.name != "en.json":
            print(f"  Untranslated (same as English): {len(same_as_en)} keys")
            for key in same_as_en:
                print(f"    ~ {key} = {en_flat[key]}")


if __name__ == "__main__":
    main()
