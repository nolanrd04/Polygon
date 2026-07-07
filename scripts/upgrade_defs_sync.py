#!/usr/bin/env python3
"""
Single source of truth for turning frontend UpgradeDef literals into the
backend's upgrades.json schema.

The frontend (`frontend/src/game/upgrades/**/*.ts`) is the source of truth
for upgrade data (see `syncing_data.md`). This module parses every exported
`<Name>Def: UpgradeDef` object literal — resolving the `ID.ts` const enums
to their string values — and remaps field names to what
`backend/app/core/upgrade_data.py` / `backend/app/core/data/upgrades.json`
expect.

Used by:
  - `python3 scripts/upgrade_defs_sync.py --write`   regenerate upgrades.json
  - `python3 scripts/upgrade_defs_sync.py`           value-parity check (exit 1 on drift)
  - `sync-check.sh`                                   same check, wired into the repo's sync workflow
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
UPGRADES_DIR = REPO_ROOT / "frontend/src/game/upgrades"
ID_FILE = REPO_ROOT / "frontend/src/game/data/ID.ts"
BACKEND_JSON = REPO_ROOT / "backend/app/core/data/upgrades.json"

CATEGORY_DIRS = ["stat_modifiers", "effects", "variants", "visual_effects", "abilities", "curses"]

# Frontend UpgradeDef field name -> backend upgrades.json field name.
# Everything not listed here is copied through unchanged.
FIELD_MAP = {
    "upgradeType": "type",
    "targetClass": "target",
    "fieldInTargetClass": "stat",
    "specificAttackType": "attackType",
}


def _parse_enums() -> dict[str, dict[str, str]]:
    """Extract `export const enum Name { Member = 'value', ... }` blocks from ID.ts."""
    text = ID_FILE.read_text()
    enums: dict[str, dict[str, str]] = {}
    for enum_match in re.finditer(r"export const enum (\w+)\s*\{([^}]*)\}", text):
        name, body = enum_match.group(1), enum_match.group(2)
        enums[name] = {
            member_match.group(1): member_match.group(2)
            for member_match in re.finditer(r"(\w+)\s*=\s*'([^']*)'", body)
        }
    return enums


def _extract_object_literal(text: str, start: int) -> str:
    """Given `start` pointing at the opening `{`, return the balanced literal (inclusive)."""
    depth = 0
    in_string: str | None = None
    i = start
    while i < len(text):
        ch = text[i]
        if in_string:
            if ch == "\\":
                i += 2
                continue
            if ch == in_string:
                in_string = None
        elif ch in "\"'`":
            in_string = ch
        elif ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return text[start:i + 1]
        i += 1
    raise ValueError(f"Unbalanced object literal starting at offset {start}")


def _literal_to_json(literal: str, enums: dict[str, dict[str, str]]) -> str:
    literal = re.sub(r"//[^\n]*", "", literal)  # strip line comments
    for enum_name, members in enums.items():
        def _sub(m: re.Match, members=members) -> str:
            return json.dumps(members[m.group(1)])
        literal = re.sub(rf"\b{enum_name}\.(\w+)\b", _sub, literal)
    literal = re.sub(r'([{,]\s*)([A-Za-z_]\w*)(\s*:)', r'\1"\2"\3', literal)  # quote bare keys
    literal = re.sub(r',(\s*[}\]])', r'\1', literal)  # drop trailing commas
    return literal


def parse_frontend_defs() -> dict[str, dict]:
    enums = _parse_enums()
    defs: dict[str, dict] = {}
    for category in CATEGORY_DIRS:
        category_dir = UPGRADES_DIR / category
        if not category_dir.exists():
            continue
        for ts_file in sorted(category_dir.glob("*.ts")):
            text = ts_file.read_text()
            for def_match in re.finditer(r"export const \w+Def\s*:\s*UpgradeDef\s*=\s*", text):
                brace_start = text.index("{", def_match.end())
                literal = _extract_object_literal(text, brace_start)
                obj = json.loads(_literal_to_json(literal, enums))
                mapped = {FIELD_MAP.get(k, k): v for k, v in obj.items()}
                upgrade_id = mapped["id"]
                if upgrade_id in defs:
                    raise ValueError(f"Duplicate upgrade id '{upgrade_id}' (in {ts_file})")
                defs[upgrade_id] = mapped
    return defs


def load_backend_upgrades() -> dict[str, dict]:
    return json.loads(BACKEND_JSON.read_text())


def diff_upgrades(frontend: dict[str, dict], backend: dict[str, dict]) -> list[str]:
    """Value-parity diff. Empty list means backend/upgrades.json matches the frontend defs exactly."""
    issues = []
    frontend_ids, backend_ids = set(frontend), set(backend)

    for missing in sorted(frontend_ids - backend_ids):
        issues.append(f"missing in backend: {missing}")
    for extra in sorted(backend_ids - frontend_ids):
        issues.append(f"missing in frontend: {extra}")

    for upgrade_id in sorted(frontend_ids & backend_ids):
        fdef, bdef = frontend[upgrade_id], backend[upgrade_id]
        for key in sorted(set(fdef) | set(bdef)):
            if fdef.get(key) != bdef.get(key):
                issues.append(f"{upgrade_id}.{key}: frontend={fdef.get(key)!r} backend={bdef.get(key)!r}")

    return issues


def main() -> int:
    frontend = parse_frontend_defs()

    if "--write" in sys.argv:
        ordered = {k: frontend[k] for k in sorted(frontend)}
        BACKEND_JSON.write_text(json.dumps(ordered, indent=2) + "\n")
        print(f"Wrote {len(ordered)} upgrades to {BACKEND_JSON.relative_to(REPO_ROOT)}")
        return 0

    backend = load_backend_upgrades()
    issues = diff_upgrades(frontend, backend)
    if issues:
        print(f"Found {len(issues)} mismatch(es) between frontend defs and backend upgrades.json:")
        for issue in issues:
            print(f"  - {issue}")
        return 1

    print(f"OK - {len(frontend)} upgrades match frontend defs exactly.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
