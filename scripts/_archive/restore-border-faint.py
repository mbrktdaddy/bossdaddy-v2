#!/usr/bin/env python3
"""
One-shot revert: undo the border-faint → border-soft swaps from the chip-
migration session. Targets specific class-string patterns so pre-existing
border-soft uses in the same files stay untouched.

Background: 19 border-faint usages were swapped to border-soft as a
workaround for Tailwind v4 falling through to currentColor (no token).
The right fix is to define --color-faint as a distinct softer tier and
restore the original class names — this script does the restore half.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

PATCHES = {
    "app/(tools)/layout.tsx": [
        ("border-b border-soft bg-surface",
         "border-b border-faint bg-surface"),
    ],
    "app/(tools)/tools/dad-math/_components/DadMathTool.tsx": [
        ("bg-surface border border-soft text-prose-faint hover:text-prose",
         "bg-surface border border-faint text-prose-faint hover:text-prose"),
    ],
    "app/(tools)/tools/weekends-until/_components/Result.tsx": [
        ("bg-surface border border-soft rounded-3xl p-6 sm:p-10 space-y-6",
         "bg-surface border border-faint rounded-3xl p-6 sm:p-10 space-y-6"),
        ("pt-4 border-t border-soft",
         "pt-4 border-t border-faint"),
    ],
    "app/(tools)/tools/weekends-until/_components/ShareMenu.tsx": [
        ("px-3 py-1.5 rounded-full border border-soft text-prose-faint hover:text-prose hover:border-accent transition-colors",
         "px-3 py-1.5 rounded-full border border-faint text-prose-faint hover:text-prose hover:border-accent transition-colors"),
    ],
    "app/(tools)/tools/weekends-until/_components/WeekendsTool.tsx": [
        ("bg-surface border border-soft text-prose-faint hover:text-prose",
         "bg-surface border border-faint text-prose-faint hover:text-prose"),
    ],
    "components/dad-tools/AddKidAffordance.tsx": [
        ("bg-surface border border-soft rounded-2xl p-4 sm:p-5",
         "bg-surface border border-faint rounded-2xl p-4 sm:p-5"),
        ("bg-surface border border-soft rounded-2xl p-6 text-center space-y-3",
         "bg-surface border border-faint rounded-2xl p-6 text-center space-y-3"),
        ("px-4 py-2.5 bg-surface border border-soft border-dashed hover:border-accent hover:bg-accent/5",
         "px-4 py-2.5 bg-surface border border-faint border-dashed hover:border-accent hover:bg-accent/5"),
    ],
    "components/dad-tools/KidCard.tsx": [
        ("bg-surface border border-soft rounded-2xl p-4 sm:p-5",
         "bg-surface border border-faint rounded-2xl p-4 sm:p-5"),
        ("border-t border-soft pt-4",
         "border-t border-faint pt-4"),
        ("bg-surface-sunken border border-soft border-dashed",
         "bg-surface-sunken border border-faint border-dashed"),
    ],
    "components/dad-tools/MomentsFeed.tsx": [
        ("bg-surface-sunken border border-soft rounded-xl px-3 py-2.5",
         "bg-surface-sunken border border-faint rounded-xl px-3 py-2.5"),
    ],
}

total = 0
for rel, patches in PATCHES.items():
    p = ROOT / rel
    if not p.exists():
        print(f"  MISS  {rel}")
        continue
    text = p.read_text(encoding="utf-8")
    n = 0
    for find, repl in patches:
        c = text.count(find)
        if c == 0:
            continue
        text = text.replace(find, repl)
        n += c
    if n > 0:
        p.write_text(text, encoding="utf-8")
        print(f"  {n:2d}  {rel}")
        total += n
print(f"\n{total} reverts.")
