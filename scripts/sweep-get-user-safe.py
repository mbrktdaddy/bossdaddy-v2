"""
Replaces every raw supabase.auth.getUser() call in app/ with getUserSafe(supabase),
and updates the import line in each file to include getUserSafe.

Run from project root:
  /c/Users/msb1c/AppData/Local/Programs/Python/Python312/python.exe scripts/sweep-get-user-safe.py
"""

import re
from pathlib import Path

PROJECT = Path(r'C:\Users\msb1c\bossdaddy-v2')

CALL_OLD = "const { data: { user } } = await supabase.auth.getUser()"
CALL_NEW  = "const { user } = await getUserSafe(supabase)"

# Matches: import { ...anything... } from '@/lib/supabase/server'
IMPORT_RE = re.compile(
    r"(import\s*\{)([^}]+)(\}\s*from\s*'@/lib/supabase/server')"
)

changed = []
skipped_already_safe = []

for ext in ('*.ts', '*.tsx'):
    for path in (PROJECT / 'app').rglob(ext):
        if '.next' in path.parts or 'node_modules' in path.parts:
            continue

        original = path.read_text(encoding='utf-8')
        if 'supabase.auth.getUser()' not in original:
            continue

        content = original

        # 1. Replace the call
        content = content.replace(CALL_OLD, CALL_NEW)

        # 2. Add getUserSafe to the server import if not already there
        def patch_import(m: re.Match) -> str:
            prefix, names, suffix = m.group(1), m.group(2), m.group(3)
            if 'getUserSafe' in names:
                return m.group(0)  # already imported
            # strip trailing comma/whitespace, then append
            names_clean = names.strip().rstrip(',')
            return f"{prefix} {names_clean}, getUserSafe {suffix}"

        content = IMPORT_RE.sub(patch_import, content)

        if content != original:
            path.write_text(content, encoding='utf-8')
            rel = str(path.relative_to(PROJECT))
            changed.append(rel)

print(f"\nUpdated {len(changed)} file(s):")
for f in sorted(changed):
    print(f"  {f}")

if not changed:
    print("  (nothing to change — all files already use getUserSafe)")
