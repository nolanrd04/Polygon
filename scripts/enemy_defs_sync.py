#!/usr/bin/env python3
"""
Single source of truth for turning frontend enemy SetDefaults() values into
the backend's enemies.json schema.

Like projectiles (see projectile_defs_sync.py), enemy stats are imperative
`this.<field> = <literal>` assignments inside each class's own SetDefaults()
(frontend/src/game/entities/enemies/*.ts), not a declarative object like
upgrades. This parses each class body, extracts SetDefaults()'s literal
numeric assignments for the fields the backend anti-cheat actually consumes
(health/damage/scoreChance/bundleDropChance), and maps class name -> enemy id
via the same registry (index.ts's ENEMY_TYPES) EnemyManager itself uses -
so a new enemy only needs adding there, same as the frontend already requires.

Not covered here - these aren't simple per-enemy SetDefaults() literals, so
they stay hand-maintained in enemies.json:
  - min_wave: derived from the difficulty spawn tables' first appearance,
    not a field on the enemy class itself.
  - hexagon_shield_ratio: an inline expression (this.health * 0.65) inside
    activateShield(), not a named SetDefaults() field.
  - boss_waves / boss_only_enemies: difficulty-level scheduling, not
    per-enemy data.
  - splits_into: behavioral (Octogon.OnDeath() spawning children), not a
    literal value.

Used by:
  - `python3 scripts/enemy_defs_sync.py --write`   regenerate the 4 covered keys
  - `python3 scripts/enemy_defs_sync.py`           value-parity check (exit 1 on drift)
  - `sync-check.sh`                                 same check, wired into the repo's sync workflow
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
ENEMIES_DIR = REPO_ROOT / "frontend/src/game/entities/enemies"
REGISTRY_FILE = ENEMIES_DIR / "index.ts"
BACKEND_JSON = REPO_ROOT / "backend/app/core/data/enemies.json"

# frontend field -> enemies.json top-level key
FIELDS = {
    "health": "base_health",
    "damage": "base_damage",
    "scoreChance": "score_chance",
    "bundleDropChance": "bundle_drop_chance",
}

# Numeric literal, including leading-dot decimals (e.g. `.65`, not just `0.65`).
NUMBER = r"-?(?:\d+\.\d+|\.\d+|\d+)"


def _extract_balanced(text: str, start: int) -> str:
    """Given `start` pointing at an opening `{`, return the balanced block
    (inclusive). Skips string/template literals AND comments - a `//`
    comment containing an unescaped apostrophe would otherwise be misread
    as opening a string literal."""
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
        elif ch == "/" and text[i:i + 2] == "//":
            i = text.find("\n", i)
            if i == -1:
                break
            continue
        elif ch == "/" and text[i:i + 2] == "/*":
            end = text.find("*/", i + 2)
            i = (end + 2) if end != -1 else len(text)
            continue
        elif ch in "\"'`":
            in_string = ch
        elif ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return text[start:i + 1]
        i += 1
    raise ValueError(f"Unbalanced block starting at offset {start}")


def _class_bodies(text: str) -> dict[str, str]:
    bodies = {}
    for m in re.finditer(r"export class (\w+) extends Enemy\b[^{]*\{", text):
        brace_start = m.end() - 1
        bodies[m.group(1)] = _extract_balanced(text, brace_start)
    return bodies


def _set_defaults_body(class_body: str) -> str | None:
    m = re.search(r"SetDefaults\(\)\s*:\s*void\s*\{", class_body)
    if not m:
        return None
    return _extract_balanced(class_body, m.end() - 1)


def _literal_fields(body: str) -> dict[str, float]:
    """this.<field> = <numeric literal>, for fields in FIELDS. Skips
    non-literal assignments (e.g. `this.baseSpeed = this.speed`) on purpose -
    those are dynamic, not fixed constants."""
    found = {}
    for field in FIELDS:
        m = re.search(rf"this\.{field}\s*=\s*({NUMBER})\b", body)
        if m:
            value = float(m.group(1))
            found[field] = int(value) if value.is_integer() else value
    return found


def _class_to_id() -> dict[str, str]:
    """Class name -> registry id, parsed from index.ts's ENEMY_TYPES array -
    the same registry EnemyManager itself resolves spawns through."""
    text = REGISTRY_FILE.read_text()
    return {
        cls: enemy_id
        for enemy_id, cls in re.findall(
            r"\{\s*id:\s*'([\w_]+)'\s*,\s*class:\s*(\w+)\s*\}", text
        )
    }


def parse_frontend_enemies() -> dict[str, dict[str, float]]:
    class_to_id = _class_to_id()
    by_key: dict[str, dict[str, float]] = {key: {} for key in FIELDS.values()}

    for ts_file in sorted(ENEMIES_DIR.glob("*.ts")):
        text = ts_file.read_text()
        for class_name, class_body in _class_bodies(text).items():
            enemy_id = class_to_id.get(class_name)
            if enemy_id is None:
                continue  # not in the registry - dead/example class

            set_defaults = _set_defaults_body(class_body)
            if set_defaults is None:
                continue

            for field, value in _literal_fields(set_defaults).items():
                by_key[FIELDS[field]][enemy_id] = value

    return by_key


def load_backend_enemies() -> dict:
    return json.loads(BACKEND_JSON.read_text())


def diff_enemies(frontend: dict[str, dict], backend: dict) -> list[str]:
    issues = []
    for key, fmap in frontend.items():
        bmap = backend.get(key, {})
        frontend_ids, backend_ids = set(fmap), set(bmap)

        for missing in sorted(frontend_ids - backend_ids):
            issues.append(f"{key}: missing in backend: {missing}")
        for extra in sorted(backend_ids - frontend_ids):
            issues.append(f"{key}: missing in frontend: {extra}")

        for enemy_id in sorted(frontend_ids & backend_ids):
            if fmap[enemy_id] != bmap.get(enemy_id):
                issues.append(f"{key}.{enemy_id}: frontend={fmap[enemy_id]!r} backend={bmap.get(enemy_id)!r}")

    return issues


def main() -> int:
    frontend = parse_frontend_enemies()

    if "--write" in sys.argv:
        backend = load_backend_enemies()
        for key, fmap in frontend.items():
            backend[key] = {enemy_id: fmap[enemy_id] for enemy_id in sorted(fmap)}
        BACKEND_JSON.write_text(json.dumps(backend, indent=2) + "\n")
        total = sum(len(fmap) for fmap in frontend.values())
        print(f"Wrote {total} field values across {len(frontend)} keys to {BACKEND_JSON.relative_to(REPO_ROOT)}")
        return 0

    backend = load_backend_enemies()
    issues = diff_enemies(frontend, backend)
    if issues:
        print(f"Found {len(issues)} mismatch(es) between frontend enemy defaults and backend enemies.json:")
        for issue in issues:
            print(f"  - {issue}")
        return 1

    total = sum(len(fmap) for fmap in frontend.values())
    print(f"OK - {total} enemy field values match frontend defaults exactly.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
