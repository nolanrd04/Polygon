#!/usr/bin/env python3
"""
Single source of truth for turning frontend projectile SetDefaults() values
into the backend's projectiles.json schema.

Unlike upgrades (declarative `UpgradeDef` object literals), projectile stats
are imperative `this.<field> = <literal>` assignments inside each class's own
SetDefaults() method
(frontend/src/game/entities/projectiles/player_projectiles/*.ts). This parses
each class body, extracts SetDefaults()'s literal numeric assignments for the
fields the backend anti-cheat actually consumes (damage/speed/pierce/
cooldown), and remaps class name -> the key backend/app/core/projectile_data.py
resolves via resolve_active_projectile() (the corresponding bullet-variant
upgrade id, or the attack type for single-class attack types).

Special cases (can't be derived generically, so they're explicit below):
  - buckshot_bullets: cooldown_ms + min/max pellets come from BuckshotBullet;
    damage/speed/pierce come from BuckshotPellet (the thing that actually
    deals damage - see the "Inherit damage from the main buckshot bullet"
    comment in BuckshotBullet.OnSpawn()).
  - explosion: BulletExplosion's damage/radius are its constructor's default
    parameter, not a SetDefaults() literal (SetDefaults() computes them
    dynamically via the upgrade-modifier hook).
  - HeavyBullet has real SetDefaults() values but no upgrade path can
    currently select it (dead content) - intentionally excluded until
    something makes it reachable.

Used by:
  - `python3 scripts/projectile_defs_sync.py --write`   regenerate projectiles.json
  - `python3 scripts/projectile_defs_sync.py`           value-parity check (exit 1 on drift)
  - `sync-check.sh`                                      same check, wired into the repo's sync workflow
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
PROJECTILES_DIR = REPO_ROOT / "frontend/src/game/entities/projectiles/player_projectiles"
BACKEND_JSON = REPO_ROOT / "backend/app/core/data/projectiles.json"

FIELDS = ("damage", "speed", "pierce")

# Class name -> projectiles.json key (mirrors resolve_active_projectile's
# domain: the bullet-variant upgrade id, or the attack type for single-class
# attack types). Not algorithmically derivable from the source.
CLASS_TO_KEY = {
    "Bullet": "bullet",
    "HomingBullet": "homing_bullets",
    "ExplosiveBullet": "explosive_bullets",
    "Laser": "laser",
    "Zapper": "zapper",
    "Flame": "flamer",
    "Spinner": "spinner",
}


def _extract_balanced(text: str, start: int) -> str:
    """Given `start` pointing at an opening `{`, return the balanced block
    (inclusive). Skips string/template literals AND comments - a `//`
    comment containing an unescaped apostrophe (e.g. "doesn't") would
    otherwise be misread as opening a string literal."""
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
    for m in re.finditer(r"export class (\w+) extends Projectile\b[^{]*\{", text):
        brace_start = m.end() - 1
        bodies[m.group(1)] = _extract_balanced(text, brace_start)
    return bodies


def _set_defaults_body(class_body: str) -> str | None:
    m = re.search(r"SetDefaults\(\)\s*:\s*void\s*\{", class_body)
    if not m:
        return None
    return _extract_balanced(class_body, m.end() - 1)


def _literal_fields(body: str) -> dict[str, float]:
    """this.<field> = <numeric literal>, for fields in FIELDS (trailing
    `// comment`s, semicolons, etc. are irrelevant - just need the number).
    Skips non-literal assignments (e.g. `this.size = this.radius`) on
    purpose - those are dynamic, not fixed constants, with no backend
    consumer."""
    found = {}
    for field in FIELDS:
        m = re.search(rf"this\.{field}\s*=\s*(-?\d+(?:\.\d+)?)\b", body)
        if m:
            value = float(m.group(1))
            found[field] = int(value) if value.is_integer() else value
    return found


def _cooldown_ms(body: str) -> int | None:
    m = re.search(r"this\.cooldown\s*=\s*(\d+)\b", body)
    return int(m.group(1)) if m else None


def _class_field_default(class_body: str, field: str) -> int | None:
    """Bare class-property declarations like `minPellets = 3` (not inside a method)."""
    m = re.search(rf"^\s*{field}\s*=\s*(\d+)\s*$", class_body, re.MULTILINE)
    return int(m.group(1)) if m else None


def parse_frontend_projectiles() -> dict[str, dict]:
    projectiles: dict[str, dict] = {}

    for ts_file in sorted(PROJECTILES_DIR.glob("*.ts")):
        text = ts_file.read_text()
        for class_name, class_body in _class_bodies(text).items():
            set_defaults = _set_defaults_body(class_body)
            if set_defaults is None:
                continue

            if class_name == "BuckshotBullet":
                cooldown = _cooldown_ms(set_defaults)
                min_pellets = _class_field_default(class_body, "minPellets")
                max_pellets = _class_field_default(class_body, "maxPellets")
                entry = projectiles.setdefault("buckshot_bullets", {})
                if cooldown is not None:
                    entry["cooldown_ms"] = cooldown
                if min_pellets is not None:
                    entry["min_pellets"] = min_pellets
                if max_pellets is not None:
                    entry["max_pellets"] = max_pellets
                continue

            if class_name == "BuckshotPellet":
                entry = projectiles.setdefault("buckshot_bullets", {})
                entry.update(_literal_fields(set_defaults))
                continue

            if class_name == "BulletExplosion":
                m = re.search(
                    r"constructor\([^)]*=\s*\{\s*damage:\s*(\d+)\s*,\s*radius:\s*(\d+)\s*\}",
                    class_body,
                )
                if m:
                    projectiles["explosion"] = {
                        "damage": int(m.group(1)),
                        "radius": int(m.group(2)),
                    }
                continue

            key = CLASS_TO_KEY.get(class_name)
            if key is None:
                continue  # e.g. HeavyBullet - real class, no reachable upgrade path

            entry = projectiles.setdefault(key, {})
            entry.update(_literal_fields(set_defaults))
            cooldown = _cooldown_ms(set_defaults)
            if cooldown is not None:
                entry["cooldown_ms"] = cooldown

    # BuckshotBullet.damage is what actually gets credited to each pellet
    # (see "Inherit damage from the main buckshot bullet" in Bullet.ts) -
    # override whatever BuckshotPellet.SetDefaults() set on its own.
    for ts_file in PROJECTILES_DIR.glob("*.ts"):
        text = ts_file.read_text()
        bodies = _class_bodies(text)
        if "BuckshotBullet" in bodies:
            set_defaults = _set_defaults_body(bodies["BuckshotBullet"])
            if set_defaults:
                damage = _literal_fields(set_defaults).get("damage")
                if damage is not None and "buckshot_bullets" in projectiles:
                    projectiles["buckshot_bullets"]["damage"] = damage

    return projectiles


def load_backend_projectiles() -> dict[str, dict]:
    return json.loads(BACKEND_JSON.read_text())


def diff_projectiles(frontend: dict[str, dict], backend: dict[str, dict]) -> list[str]:
    issues = []
    frontend_ids, backend_ids = set(frontend), set(backend)

    for missing in sorted(frontend_ids - backend_ids):
        issues.append(f"missing in backend: {missing}")
    for extra in sorted(backend_ids - frontend_ids):
        issues.append(f"missing in frontend: {extra}")

    for key in sorted(frontend_ids & backend_ids):
        fdef, bdef = frontend[key], backend[key]
        for field in sorted(set(fdef) | set(bdef)):
            if fdef.get(field) != bdef.get(field):
                issues.append(f"{key}.{field}: frontend={fdef.get(field)!r} backend={bdef.get(field)!r}")

    return issues


def main() -> int:
    frontend = parse_frontend_projectiles()

    if "--write" in sys.argv:
        ordered = {k: frontend[k] for k in sorted(frontend)}
        BACKEND_JSON.write_text(json.dumps(ordered, indent=2) + "\n")
        print(f"Wrote {len(ordered)} projectiles to {BACKEND_JSON.relative_to(REPO_ROOT)}")
        return 0

    backend = load_backend_projectiles()
    issues = diff_projectiles(frontend, backend)
    if issues:
        print(f"Found {len(issues)} mismatch(es) between frontend projectile defaults and backend projectiles.json:")
        for issue in issues:
            print(f"  - {issue}")
        return 1

    print(f"OK - {len(frontend)} projectiles match frontend defaults exactly.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
