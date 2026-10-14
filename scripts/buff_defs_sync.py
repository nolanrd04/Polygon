#!/usr/bin/env python3
"""
Turns the frontend buff defs and bundle buff whitelist into the backend's
buffs.json, and checks the two stay in sync.

Sources (the frontend is the source of truth):
  - `frontend/src/game/buffs/{positive,debuffs}/*.ts`: every `<Name>Def: BuffDef`
    literal, minus UI-only fields.
  - `frontend/src/game/buffs/bundleDrops.ts`: BUNDLE_BUFF_DROPS and the default
    duration range. Entries with a custom `roll` are marked `hasRoll`; the
    function itself is hand-ported to `backend/app/core/buff_rolls.py`.

Also fails if an entry has a `roll` with no handler in buff_rolls.ROLLS. That
catches a roll nobody ported, not one ported wrong.

Used by:
  - `python3 scripts/buff_defs_sync.py --write`   regenerate buffs.json
  - `python3 scripts/buff_defs_sync.py`           parity check (exit 1 on drift)
  - `sync-check.sh`                               same check
"""

from __future__ import annotations

import importlib.util
import json
import re
import sys
from pathlib import Path

from upgrade_defs_sync import _extract_object_literal, _literal_to_json, _parse_enums

REPO_ROOT = Path(__file__).resolve().parent.parent
BUFFS_DIR = REPO_ROOT / "frontend/src/game/buffs"
DROPS_FILE = BUFFS_DIR / "bundleDrops.ts"
BUFF_ROLLS_FILE = REPO_ROOT / "backend/app/core/buff_rolls.py"
BACKEND_JSON = REPO_ROOT / "backend/app/core/data/buffs.json"

DEF_DIRS = ["positive", "debuffs"]
UI_ONLY_FIELDS = {"icon", "color", "tintStrength", "hidden"}


def _single_to_double_quotes(literal: str) -> str:
    """Buff defs use '...' strings, which JSON can't read. Leaves "..." strings alone."""
    out: list[str] = []
    i = 0
    while i < len(literal):
        ch = literal[i]
        if ch in "\"'":
            j = i + 1
            while j < len(literal) and literal[j] != ch:
                j += 2 if literal[j] == "\\" else 1
            body = literal[i + 1:j]
            out.append(json.dumps(body.replace("\\'", "'")) if ch == "'" else literal[i:j + 1])
            i = j + 1
            continue
        out.append(ch)
        i += 1
    return "".join(out)


def parse_buff_defs(enums: dict[str, dict[str, str]]) -> dict[str, dict]:
    defs: dict[str, dict] = {}
    for sub in DEF_DIRS:
        for ts_file in sorted((BUFFS_DIR / sub).glob("*.ts")):
            text = ts_file.read_text()
            for def_match in re.finditer(r"export const \w+Def\s*:\s*BuffDef\s*=\s*", text):
                brace_start = text.index("{", def_match.end())
                literal = _extract_object_literal(text, brace_start)
                obj = json.loads(_literal_to_json(_single_to_double_quotes(literal), enums))
                buff_id = obj["id"]
                if buff_id in defs:
                    raise ValueError(f"Duplicate buff id '{buff_id}' (in {ts_file})")
                defs[buff_id] = {k: v for k, v in obj.items() if k not in UI_ONLY_FIELDS}
    return defs


def _const_number(text: str, name: str) -> int:
    match = re.search(rf"export const {name}\s*=\s*(\d+)", text)
    if not match:
        raise ValueError(f"{name} not found in {DROPS_FILE.name}")
    return int(match.group(1))


def parse_bundle_drops(enums: dict[str, dict[str, str]]) -> tuple[dict, list[dict]]:
    text = DROPS_FILE.read_text()
    defaults = {
        "minDuration": _const_number(text, "DEFAULT_DROP_MIN_DURATION"),
        "maxDuration": _const_number(text, "DEFAULT_DROP_MAX_DURATION"),
    }

    array_match = re.search(r"export const BUNDLE_BUFF_DROPS\s*:\s*BundleBuffDrop\[\]\s*=\s*\[", text)
    if not array_match:
        raise ValueError(f"BUNDLE_BUFF_DROPS not found in {DROPS_FILE.name}")

    drops: list[dict] = []
    i = array_match.end()
    while True:
        next_brace = text.find("{", i)
        array_end = text.find("]", i)
        # Skip `//` comments between entries; find() alone would read into them.
        line_comment = text.find("//", i)
        if line_comment != -1 and line_comment < min(x for x in (next_brace, array_end) if x != -1):
            i = text.find("\n", line_comment)
            continue
        if next_brace == -1 or (array_end != -1 and array_end < next_brace):
            break
        entry = _extract_object_literal(text, next_brace)
        i = next_brace + len(entry)

        # Only the plain fields are read as data. `roll` is code, so it just marks the entry.
        buff_ref = re.search(r"\bbuff\s*:\s*BuffID\.(\w+)", entry)
        if not buff_ref:
            raise ValueError(f"Bundle drop without a BuffID: {entry}")
        drop: dict = {"buff": enums["BuffID"][buff_ref.group(1)]}
        for field in ("minDuration", "maxDuration"):
            value = re.search(rf"\b{field}\s*:\s*(\d+)", entry)
            if value:
                drop[field] = int(value.group(1))
        if re.search(r"\broll\s*:", entry):
            drop["hasRoll"] = True
        drops.append(drop)

    return defaults, drops


def parse_frontend() -> dict:
    enums = _parse_enums()
    defaults, drops = parse_bundle_drops(enums)
    buffs = parse_buff_defs(enums)
    return {
        "dropDefaults": defaults,
        "bundleDrops": drops,
        "buffs": {k: buffs[k] for k in sorted(buffs)},
    }


def _ported_rolls() -> set[str]:
    spec = importlib.util.spec_from_file_location("buff_rolls", BUFF_ROLLS_FILE)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return set(module.ROLLS)


def check_rolls_ported(frontend: dict) -> list[str]:
    ported = _ported_rolls()
    return [
        f"{drop['buff']} has a custom roll in bundleDrops.ts but no handler in buff_rolls.ROLLS"
        for drop in frontend["bundleDrops"]
        if drop.get("hasRoll") and drop["buff"] not in ported
    ]


def check_drops_known(frontend: dict) -> list[str]:
    return [
        f"bundle drop {drop['buff']} has no BuffDef"
        for drop in frontend["bundleDrops"]
        if drop["buff"] not in frontend["buffs"]
    ]


def diff(frontend: dict, backend: dict) -> list[str]:
    issues = []
    if frontend["dropDefaults"] != backend.get("dropDefaults"):
        issues.append(f"dropDefaults: frontend={frontend['dropDefaults']} backend={backend.get('dropDefaults')}")
    if frontend["bundleDrops"] != backend.get("bundleDrops"):
        issues.append("bundleDrops differ (whitelist, durations or roll markers)")

    f_buffs, b_buffs = frontend["buffs"], backend.get("buffs", {})
    for missing in sorted(set(f_buffs) - set(b_buffs)):
        issues.append(f"missing in backend: {missing}")
    for extra in sorted(set(b_buffs) - set(f_buffs)):
        issues.append(f"missing in frontend: {extra}")
    for buff_id in sorted(set(f_buffs) & set(b_buffs)):
        fdef, bdef = f_buffs[buff_id], b_buffs[buff_id]
        for key in sorted(set(fdef) | set(bdef)):
            if fdef.get(key) != bdef.get(key):
                issues.append(f"{buff_id}.{key}: frontend={fdef.get(key)!r} backend={bdef.get(key)!r}")
    return issues


def main() -> int:
    frontend = parse_frontend()
    source_issues = check_drops_known(frontend) + check_rolls_ported(frontend)

    if "--write" in sys.argv:
        BACKEND_JSON.write_text(json.dumps(frontend, indent=2) + "\n")
        print(f"Wrote {len(frontend['buffs'])} buffs, {len(frontend['bundleDrops'])} bundle drops to {BACKEND_JSON.relative_to(REPO_ROOT)}")
        for issue in source_issues:
            print(f"  ! {issue}")
        return 1 if source_issues else 0

    backend = json.loads(BACKEND_JSON.read_text()) if BACKEND_JSON.exists() else {}
    issues = source_issues + diff(frontend, backend)
    if issues:
        print(f"Found {len(issues)} buff sync issue(s):")
        for issue in issues:
            print(f"  - {issue}")
        return 1

    print(f"OK - {len(frontend['buffs'])} buffs and {len(frontend['bundleDrops'])} bundle drops match frontend defs exactly.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())