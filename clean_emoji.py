"""
clean_emoji.py - 扫描并清除项目源码中的 emoji 字符。
"""
from __future__ import annotations

import re
from pathlib import Path


ROOT = Path(__file__).resolve().parent
EXTENSIONS = {".py", ".json"}
SKIP_DIRS = {".git", "build", "dist", "data", "__pycache__"}
EMOJI_PATTERN = re.compile(
    "["
    "\U0001F300-\U0001F9FF"
    "\U00002702-\U000027B0"
    "\U0000FE00-\U0000FE0F"
    "\U0000200D"
    "\U00002600-\U000026FF"
    "\U0000231A-\U0000231B"
    "\U00002328"
    "\U000023E9-\U000023F3"
    "\U000023F8-\U000023FA"
    "\U000025AA-\U000025FE"
    "\U00002934-\U00002935"
    "\U00003030"
    "\U0000303D"
    "\U00003297"
    "\U00003299"
    "]+",
    flags=re.UNICODE,
)


def main() -> None:
    changed = 0
    for path in ROOT.rglob("*"):
        if not path.is_file() or path.suffix not in EXTENSIONS:
            continue
        if any(part in SKIP_DIRS for part in path.parts):
            continue

        content = path.read_text(encoding="utf-8")
        cleaned = EMOJI_PATTERN.sub("", content)
        if cleaned == content:
            continue

        path.write_text(cleaned, encoding="utf-8")
        print(f"{path}: removed {len(content) - len(cleaned)} emoji chars")
        changed += 1

    print(f"\nDone! Files updated: {changed}")


if __name__ == "__main__":
    main()
