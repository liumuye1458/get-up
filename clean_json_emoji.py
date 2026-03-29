"""
clean_json_emoji.py - clean emoji characters from i18n json files only.
"""
from __future__ import annotations

import json
import re
from pathlib import Path


I18N_DIR = Path(__file__).resolve().parent / "i18n"
EMOJI_RE = re.compile(
    "["
    "\U0001F000-\U0001FFFF"
    "\U00002702-\U000027B0"
    "\U0000FE00-\U0000FE0F"
    "\U0000200D"
    "\U00002600-\U000026FF"
    "\U00002328"
    "\U0000231A-\U000023FF"
    "\U000025AA-\U000025FE"
    "\U00002934-\U00002935"
    "\U00002B05-\U00002B55"
    "\U00003030\U0000303D\U00003297\U00003299"
    "]+",
    flags=re.UNICODE,
)


def main() -> None:
    for path in sorted(I18N_DIR.glob("*.json")):
        raw = path.read_text(encoding="utf-8-sig")
        cleaned = EMOJI_RE.sub("", raw)
        if cleaned != raw:
            print(f"{path.name}: emoji removed")
            path.write_text(cleaned, encoding="utf-8")
        try:
            json.loads(cleaned)
        except json.JSONDecodeError as exc:
            print(f"  ERROR: {path.name} is invalid JSON after cleanup: {exc}")


if __name__ == "__main__":
    main()
