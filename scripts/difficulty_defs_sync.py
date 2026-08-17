#!/usr/bin/env python3
"""
Single source of truth for turning frontend/src/game/systems/difficulty/Normal.ts's
per-wave tables into backend/app/core/data/difficulty_normal.json.

Unlike upgrades/projectiles/enemies (per-class SetDefaults() literals scattered
across many files), Normal.ts's data lives in a handful of named top-level
object/array literals in one file, so this parses those directly by name:
  ENEMY_COUNTS                 -> enemy_counts
  SPAWN_WEIGHTS                -> spawn_weights
  FALLBACK_WEIGHTS             -> fallback_spawn_weights
  SCHEDULED_BOSS_SPAWNS        -> scheduled_boss_spawns
  BUNDLE_RARITY_WEIGHTS_BY_WAVE -> bundle_rarity_weights
  FALLBACK_BUNDLE_RARITY_WEIGHTS -> fallback_bundle_rarity_weights

SCHEDULED_BOSS_SPAWNS entries are usually string literals ('hexagon') but the
arrow_head boss is referenced as `ARROW_HEAD_IDS.head` (a shared constant, not
a literal - see enemy_defs_sync.py's docstring for the same pattern showing up
in enemy stats). Those are resolved against ArrowHeadConfig.ts's ARROW_HEAD_IDS
so this script doesn't need its own hardcoded copy of those ids.

Not covered here - hand-ported as *code*, not table data, because that's how
Normal.ts itself implements them (see backend/app/core/difficulty/normal.py):
  - getSpawnDelay(): a tiered formula, and not consumed by backend anti-cheat
    at all (Difficulty.get_spawn_delay() has no caller in wave_service.py) -
    there is nothing server-side to keep in sync against.
  - getEnemyCount()'s fallback formula, getBundleDropChance(),
    getHealthMultiplier()/getDamageMultiplier()/getSpeedMultiplier(): closed-form
    formulas, already hand-ported 1:1 into difficulty/normal.py.
  - getRarityWeights(): RARITY_WEIGHTS_BY_WAVE is a separate frontend table
    backed by its own backend file (rarity_weights.json), not this one.

Used by:
  - `python3 scripts/difficulty_defs_sync.py --write`   regenerate the backend copy
  - `python3 scripts/difficulty_defs_sync.py`           value-parity check (exit 1 on drift)
  - `sync-check.sh`                                      same check, wired into the repo's sync workflow
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
NORMAL_TS = REPO_ROOT / "frontend/src/game/systems/difficulty/Normal.ts"
ARROW_HEAD_CONFIG_TS = REPO_ROOT / "frontend/src/game/entities/enemies/ArrowHead/ArrowHeadConfig.ts"
BACKEND_JSON = REPO_ROOT / "backend/app/core/data/difficulty_normal.json"

NUMBER = r"-?(?:\d+\.\d+|\.\d+|\d+)"

SECTIONS = (
    "enemy_counts",
    "spawn_weights",
    "fallback_spawn_weights",
    "scheduled_boss_spawns",
    "bundle_rarity_weights",
    "fallback_bundle_rarity_weights",
)


def _extract_balanced(text: str, start: int, open_ch: str, close_ch: str) -> str:
    """Given `start` pointing at `open_ch`, return the balanced span
    (inclusive), skipping string literals so a bracket inside a quoted string
    can't be mistaken for real nesting."""
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
        elif ch == open_ch:
            depth += 1
        elif ch == close_ch:
            depth -= 1
            if depth == 0:
                return text[start : i + 1]
        i += 1
    raise ValueError(f"Unbalanced {open_ch!r} starting at offset {start}")


def _named_object(text: str, name: str) -> str:
    """Body (inclusive braces) of `const NAME: ... = { ... }` / `export const NAME = { ... }`."""
    m = re.search(rf"(?:export\s+)?const {name}\b[^=]*=\s*\{{", text)
    if not m:
        raise ValueError(f"{name} not found")
    return _extract_balanced(text, m.end() - 1, "{", "}")


def _named_array(text: str, name: str) -> str:
    """Body (inclusive brackets) of `const NAME: ... = [ ... ]`."""
    m = re.search(rf"const {name}\b[^=]*=\s*\[", text)
    if not m:
        raise ValueError(f"{name} not found")
    return _extract_balanced(text, m.end() - 1, "[", "]")


def _wave_entries(object_text: str) -> list[tuple[int, str]]:
    """[(wave, raw_value_text), ...] for `<wave>: <value>,` entries at the
    object literal's top level. `raw_value_text` is the exact source span for
    the value - a `{...}`, `[...]`, or a bare number - so callers parse it
    however fits the field."""
    entries = []
    key_re = re.compile(r"(\d+)\s*:\s*")
    i, n = 1, len(object_text) - 1  # skip the outer braces
    while i < n:
        m = key_re.match(object_text, i)
        if not m:
            i += 1
            continue
        wave = int(m.group(1))
        vstart = m.end()
        ch = object_text[vstart]
        if ch in "{[":
            value_text = _extract_balanced(object_text, vstart, ch, "}" if ch == "{" else "]")
        else:
            value_text = re.match(NUMBER, object_text[vstart:]).group(0)
        entries.append((wave, value_text))
        i = vstart + len(value_text)
    return entries


def _spawn_weight_list(text: str) -> list[dict]:
    """[{ type: 'x', weight: 10 }, ...] -> [{"type": "x", "weight": 10}, ...]"""
    out = []
    for m in re.finditer(rf"type:\s*'([\w_]+)'\s*,\s*weight:\s*({NUMBER})", text):
        weight = float(m.group(2))
        out.append({"type": m.group(1), "weight": int(weight) if weight.is_integer() else weight})
    return out


def _kv_number_pairs(text: str) -> dict[str, float]:
    """{ common: 0.25, uncommon: 0.37, ... } -> {"common": 0.25, ...}. Values
    stay floats even when whole (0.0), unlike spawn weights - these are
    probabilities, not counts."""
    return {m.group(1): float(m.group(2)) for m in re.finditer(rf"(\w+)\s*:\s*({NUMBER})", text)}


def _load_arrow_head_ids() -> dict[str, str]:
    text = ARROW_HEAD_CONFIG_TS.read_text()
    body = _named_object(text, "ARROW_HEAD_IDS")
    return {f"ARROW_HEAD_IDS.{m.group(1)}": m.group(2) for m in re.finditer(r"(\w+):\s*'([\w_]+)'", body)}


def _boss_spawn_list(text: str, id_refs: dict[str, str]) -> list[str]:
    """['hexagon', ARROW_HEAD_IDS.head, ...] -> ["hexagon", "arrow_head", ...]"""
    out = []
    for m in re.finditer(r"'([\w_]+)'|([\w_]+\.[\w_]+)", text):
        out.append(m.group(1) if m.group(1) is not None else id_refs[m.group(2)])
    return out


def parse_frontend() -> dict:
    text = NORMAL_TS.read_text()
    id_refs = _load_arrow_head_ids()

    return {
        "enemy_counts": {wave: int(float(v)) for wave, v in _wave_entries(_named_object(text, "ENEMY_COUNTS"))},
        "spawn_weights": {wave: _spawn_weight_list(v) for wave, v in _wave_entries(_named_object(text, "SPAWN_WEIGHTS"))},
        "fallback_spawn_weights": _spawn_weight_list(_named_array(text, "FALLBACK_WEIGHTS")),
        "scheduled_boss_spawns": {
            wave: _boss_spawn_list(v, id_refs) for wave, v in _wave_entries(_named_object(text, "SCHEDULED_BOSS_SPAWNS"))
        },
        "bundle_rarity_weights": {
            wave: _kv_number_pairs(v) for wave, v in _wave_entries(_named_object(text, "BUNDLE_RARITY_WEIGHTS_BY_WAVE"))
        },
        "fallback_bundle_rarity_weights": _kv_number_pairs(_named_object(text, "FALLBACK_BUNDLE_RARITY_WEIGHTS")),
    }


def load_backend() -> dict:
    return json.loads(BACKEND_JSON.read_text())


def _normalized(section: str, value, *, from_backend: bool):
    """Both sides down to plain, comparable Python values, keyed the same way."""
    if section == "fallback_spawn_weights":
        return {item["type"]: item["weight"] for item in value}
    if section == "fallback_bundle_rarity_weights":
        return value
    # every other section is wave-keyed - JSON forces string keys on the
    # backend side, ints on the parsed frontend side.
    return {int(k): v for k, v in value.items()} if from_backend else value


def diff_all(frontend: dict, backend: dict) -> list[str]:
    issues = []
    for section in SECTIONS:
        fmap = _normalized(section, frontend[section], from_backend=False)
        bmap = _normalized(section, backend.get(section, {}), from_backend=True)
        fkeys, bkeys = set(fmap), set(bmap)

        for missing in sorted(fkeys - bkeys, key=str):
            issues.append(f"{section}: missing in backend: {missing}")
        for extra in sorted(bkeys - fkeys, key=str):
            issues.append(f"{section}: missing in frontend: {extra}")
        for key in sorted(fkeys & bkeys, key=str):
            if fmap[key] != bmap[key]:
                issues.append(f"{section}.{key}: frontend={fmap[key]!r} backend={bmap[key]!r}")
    return issues


# ---------------------------------------------------------------------------
# --write: regenerate backend/app/core/data/difficulty_normal.json, keeping
# its hand-curated compact layout (one wave per line, several enemy_counts
# per line) rather than exploding it with json.dumps(indent=2).
# ---------------------------------------------------------------------------


def _json(value) -> str:
    return json.dumps(value, separators=(", ", ": "))


def _render(frontend: dict) -> str:
    lines = ["{"]

    counts = frontend["enemy_counts"]
    lines.append('  "enemy_counts": {')
    waves = sorted(counts)
    for row_start in range(0, len(waves), 5):
        row = waves[row_start : row_start + 5]
        entries = ", ".join(f'"{w}": {counts[w]}' for w in row)
        comma = "," if row_start + 5 < len(waves) else ""
        lines.append(f"    {entries}{comma}")
    lines.append("  },")

    lines.append('  "spawn_weights": {')
    weights = frontend["spawn_weights"]
    for i, wave in enumerate(sorted(weights)):
        comma = "," if i < len(weights) - 1 else ""
        lines.append(f'    "{wave}": {_json(weights[wave])}{comma}')
    lines.append("  },")

    lines.append('  "fallback_spawn_weights": [')
    fallback = frontend["fallback_spawn_weights"]
    for i, item in enumerate(fallback):
        comma = "," if i < len(fallback) - 1 else ""
        lines.append(f"    {_json(item)}{comma}")
    lines.append("  ],")

    lines.append('  "scheduled_boss_spawns": {')
    boss = frontend["scheduled_boss_spawns"]
    for i, wave in enumerate(sorted(boss)):
        comma = "," if i < len(boss) - 1 else ""
        lines.append(f'    "{wave}": {_json(boss[wave])}{comma}')
    lines.append("  },")

    lines.append('  "bundle_rarity_weights": {')
    rarity = frontend["bundle_rarity_weights"]
    for i, wave in enumerate(sorted(rarity)):
        comma = "," if i < len(rarity) - 1 else ""
        lines.append(f'    "{wave}": {_json(rarity[wave])}{comma}')
    lines.append("  },")

    lines.append(f'  "fallback_bundle_rarity_weights": {_json(frontend["fallback_bundle_rarity_weights"])}')
    lines.append("}")
    return "\n".join(lines) + "\n"


def main() -> int:
    frontend = parse_frontend()

    if "--write" in sys.argv:
        BACKEND_JSON.write_text(_render(frontend))
        total = sum(len(frontend[s]) if isinstance(frontend[s], dict) else len(frontend[s]) for s in SECTIONS)
        print(f"Wrote {len(SECTIONS)} table(s) ({total} entries) to {BACKEND_JSON.relative_to(REPO_ROOT)}")
        return 0

    backend = load_backend()
    issues = diff_all(frontend, backend)
    if issues:
        print(f"Found {len(issues)} mismatch(es) between Normal.ts difficulty tables and backend difficulty_normal.json:")
        for issue in issues:
            print(f"  - {issue}")
        return 1

    total = sum(len(frontend[s]) if isinstance(frontend[s], dict) else len(frontend[s]) for s in SECTIONS)
    print(f"OK - {total} difficulty table entries match frontend defaults exactly.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
