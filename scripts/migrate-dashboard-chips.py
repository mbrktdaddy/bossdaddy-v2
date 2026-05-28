#!/usr/bin/env python3
"""
One-shot migration: rewrite raw color-50/300/700 chip patterns in the
dashboard route group to the new theme-aware tokens. Run once, delete.

Token recipe (defined in app/globals.css):
  bg-{state}-bg   border-{state}-line   text-{state}-ink

Mapping:
  red    → danger
  amber  → warn
  green  → success
  blue   → info

NOT migrated (these are not chip patterns):
  text-red-500   — icon hue
  bg-red-600/700 — destructive button surface
  hover:bg-red-600 etc. — button hover states
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TARGETS = [
    ROOT / "app" / "(dashboard)",
    ROOT / "app" / "(tools)",
    ROOT / "app" / "(public)" / "account",
    ROOT / "components" / "dad-tools",
]

# Color name → state name
STATE = {"red": "danger", "amber": "warn", "green": "success", "blue": "info"}

# Substitutions in order. Each tuple is (pattern, replacement).
# Patterns are exact substrings — no regex.
SUBS = []
for color, state in STATE.items():
    SUBS.extend([
        # bg layer — pale 50/100 → state-bg
        (f"bg-{color}-50",          f"bg-{state}-bg"),
        (f"bg-{color}-100",         f"bg-{state}-bg"),
        # border layer — 300/200 → state-line
        (f"border-{color}-300",     f"border-{state}-line"),
        (f"border-{color}-200",     f"border-{state}-line"),
        # text layer — 700 → state-ink
        (f"text-{color}-700",       f"text-{state}-ink"),
        # hover variants
        (f"hover:bg-{color}-50",    f"hover:bg-{state}-bg"),
        (f"hover:bg-{color}-100",   f"hover:bg-{state}-bg"),
        (f"hover:bg-{color}-200",   f"hover:bg-{state}-line"),
        (f"hover:border-{color}-300", f"hover:border-{state}-line"),
    ])

# yellow-* (1 outlier) is a warn variant
SUBS.append(("bg-yellow-50",   "bg-warn-bg"))
SUBS.append(("text-yellow-700","text-warn-ink"))

def migrate(path: Path) -> int:
    """Apply substitutions to one file. Returns total substitution count."""
    text = path.read_text(encoding="utf-8")
    original = text
    count = 0
    for pat, rep in SUBS:
        new = text.replace(pat, rep)
        if new != text:
            count += text.count(pat)
            text = new
    if text != original:
        path.write_text(text, encoding="utf-8")
    return count

def main() -> None:
    files = []
    for t in TARGETS:
        if not t.exists():
            print(f"target not found: {t}")
            continue
        files.extend(p for p in t.rglob("*") if p.suffix in {".tsx", ".ts"})
    total = 0
    touched = 0
    for f in files:
        n = migrate(f)
        if n > 0:
            print(f"  {n:3d}  {f.relative_to(ROOT)}")
            total += n
            touched += 1
    print(f"\n{total} substitutions across {touched} files (of {len(files)} scanned).")

if __name__ == "__main__":
    main()
