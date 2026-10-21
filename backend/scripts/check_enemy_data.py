"""
Consistency check for the hand-ported enemy/difficulty data. A missing key
here doesn't error at runtime - validate_enemy_spawn fails closed, so an
honest kill gets flagged as cheating instead. Run it after adding an enemy
or editing a spawn table. No DB, no app imports.

Usage (from backend/):
  venv/bin/python scripts/check_enemy_data.py

Checks:
  - every enemy in base_health has base_damage, min_wave and score_chance
    (bundle_drop_chance / splits_into / spawn_families are optional - a
    missing key means "use the default")
  - every type in difficulty_*.json spawn tables and boss schedules, and in
    the frontend's difficulty/*.ts spawn tables, is a known enemy
  - no spawn table spawns a type before its min_wave, and boss-only types
    only appear in boss schedules on boss waves
Exits 1 if anything fails.
"""

import json
import re
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent
DATA = BACKEND / "app" / "core" / "data"
FRONTEND_DIFFICULTY = BACKEND.parent / "frontend" / "src" / "game" / "systems" / "difficulty"

REQUIRED_SECTIONS = ["base_damage", "min_wave", "score_chance"]
OPTIONAL_SECTIONS = ["bundle_drop_chance", "bundle_drop_max", "splits_into", "spawn_families"]


def main():
    enemies = json.loads((DATA / "enemies.json").read_text())
    known = set(enemies["base_health"])
    min_wave = enemies["min_wave"]
    boss_only = set(enemies["boss_only_enemies"])
    boss_waves = set(enemies["boss_waves"])
    errors = []

    for section in REQUIRED_SECTIONS:
        for name in sorted(known - set(enemies[section])):
            errors.append(f"enemies.json: {name} missing from {section}")
    for section in REQUIRED_SECTIONS + OPTIONAL_SECTIONS:
        for name in sorted(set(enemies.get(section, {})) - known):
            errors.append(f"enemies.json: {section} has unknown enemy {name}")
    for name in sorted(boss_only - known):
        errors.append(f"enemies.json: boss_only_enemies has unknown enemy {name}")

    for path in sorted(DATA.glob("difficulty_*.json")):
        difficulty = json.loads(path.read_text())
        tables = {f"wave {w}": t for w, t in difficulty["spawn_weights"].items()}
        tables["fallback"] = difficulty["fallback_spawn_weights"]
        for label, table in tables.items():
            wave = int(label.split()[1]) if label != "fallback" else None
            for entry in table:
                name = entry["type"]
                if name not in known:
                    errors.append(f"{path.name} {label}: unknown enemy {name!r}")
                elif name in boss_only:
                    errors.append(f"{path.name} {label}: boss-only {name} in a spawn table")
                elif wave is not None and name in min_wave and wave < min_wave[name]:
                    errors.append(f"{path.name} {label}: {name} spawns before min_wave {min_wave[name]}")
        for wave, names in difficulty["scheduled_boss_spawns"].items():
            for name in names:
                if name not in known:
                    errors.append(f"{path.name} boss wave {wave}: unknown enemy {name!r}")
                elif name in boss_only and int(wave) not in boss_waves:
                    errors.append(f"{path.name}: boss {name} scheduled on non-boss wave {wave}")

    # The frontend tables are the source of truth, so a typo there means an
    # enemy silently never spawns (EnemyManager.spawnEnemy returns null).
    for path in sorted(FRONTEND_DIFFICULTY.glob("*.ts")):
        for name in sorted(set(re.findall(r"type:\s*'([^']+)'", path.read_text()))):
            if name not in known:
                errors.append(f"frontend {path.name}: unknown enemy {name!r}")

    for error in errors:
        print(error)
    print(f"{len(errors)} problem(s)" if errors else "Enemy data OK")
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()