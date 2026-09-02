"""
Per-wave scaling ratio for the single most recent GameRun (by started_at) -
"is my damage output keeping pace with enemy health", for one playtest, not
a cross-run trend (see analyze_runs.py for that). No plots, table only.

Reads MongoDB directly (no API, no auth) - run it from backend/ with the
venv python. Honors MONGODB_URL / MONGODB_DATABASE env vars.

Usage (from backend/):
  venv/bin/python scripts/damage_scaling_ratio.py

For each wave, everything is expressed as a fold-change relative to wave 1
of the same run:
  proj_fold   player_projectile_damage(wave) / player_projectile_damage(wave 1)
  curve_fold  enemy_health_multiplier(wave) / enemy_health_multiplier(wave 1)
              - the pure per-enemy difficulty curve, independent of how many
              enemies spawn
  pool_fold   enemy_total_health_spawned(wave) / enemy_total_health_spawned(wave 1)
              - total wave pressure: curve x enemy count x composition,
              INCLUDING scheduled boss spawns (wave 10/20/30's dodecahedron
              etc.), which are deliberate spikes and not something proj_fold
              is meant to track 1:1
  pool_ex_boss / vs_pool_ex
              - same as pool_fold/vs_pool but with the scheduled boss spawn's
              health subtracted out first, so boss waves don't read as
              "damage isn't keeping up" when it's actually just the boss
              doing its job. Boss health is recomputed from the current
              enemy/difficulty tables (app.core.enemy_data /
              app.core.difficulty), not read back from the stored snapshot -
              if those tables changed since this run was played, this column
              drifts from what was actually true at play time (pool_fold
              doesn't have this problem; it's the exact value recorded then).
              Boss waves are marked with a trailing '*'.

vs_curve / vs_pool are proj_fold / curve_fold and proj_fold / pool_fold -
values above 1.0 mean your damage is outscaling that measure of enemy health.
"""

import os
import sys

from pymongo import MongoClient

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.difficulty import get_difficulty
from app.core.enemy_data import get_enemy_health, HEXAGON_SHIELD_RATIO, ENEMY_SPLITS_INTO

MONGODB_URL = os.environ.get("MONGODB_URL", "mongodb://localhost:27017")
MONGODB_DATABASE = os.environ.get("MONGODB_DATABASE", "polygon_game")


def _boss_health(wave, difficulty):
    """
    Total effective health of this wave's scheduled boss spawn (if any),
    mirroring enemy_data.calculate_expected_health_spawned's own
    effective_health closure: hexagon-family shields and one level of split
    children both count, since that's what actually has to be chewed through.
    """
    def effective_health(enemy_type):
        health = float(get_enemy_health(enemy_type, wave, difficulty))
        if enemy_type in ("hexagon", "super_hexagon"):
            health += int(health * HEXAGON_SHIELD_RATIO)
        for child in ENEMY_SPLITS_INTO.get(enemy_type, []):
            child_health = float(get_enemy_health(child, wave, difficulty))
            if child in ("hexagon", "super_hexagon"):
                child_health += int(child_health * HEXAGON_SHIELD_RATIO)
            health += child_health
        return health

    boss_spawns = difficulty.get_scheduled_boss_spawns(wave) or []
    return sum(effective_health(t) for t in boss_spawns)


def main():
    db = MongoClient(MONGODB_URL)[MONGODB_DATABASE]

    run = db.game_runs.find_one(
        {"wave_snapshots.0": {"$exists": True}},
        sort=[("started_at", -1)],
    )
    if not run:
        print("No runs with recorded waves found.")
        return

    difficulty = get_difficulty(run.get("difficulty_id", "normal"))

    snaps = sorted(run["wave_snapshots"], key=lambda s: s["wave_number"])
    base_proj = snaps[0].get("player_projectile_damage") or 1
    base_curve = snaps[0].get("enemy_health_multiplier") or 1
    base_pool = snaps[0].get("enemy_total_health_spawned") or 1
    base_pool_ex_boss = base_pool - _boss_health(snaps[0]["wave_number"], difficulty)

    # run.game_version is stamped once at creation; a mid-run version bump
    # means later waves can carry a newer version on their own snapshot -
    # report both rather than the possibly-stale run-level one alone.
    latest_version = snaps[-1].get("game_version", run.get("game_version"))
    print(f"run {run['_id']}  started {run.get('started_at')}  "
          f"status={run.get('status')}  "
          f"version={run.get('game_version')} (started) -> {latest_version} (latest wave)")
    print(f"{'wave':>5}  {'proj_fold':>10}  {'curve_fold':>11}  {'pool_fold':>10}  "
          f"{'vs_curve':>9}  {'vs_pool':>8}  {'pool_ex_boss':>13}  {'vs_pool_ex':>11}")

    for s in snaps:
        wave = s["wave_number"]
        boss_hp = _boss_health(wave, difficulty)
        is_boss_wave = boss_hp > 0

        proj_fold = (s.get("player_projectile_damage") or 0) / base_proj
        curve_fold = (s.get("enemy_health_multiplier") or 0) / base_curve
        pool_fold = (s.get("enemy_total_health_spawned") or 0) / base_pool
        vs_curve = proj_fold / curve_fold if curve_fold else float("nan")
        vs_pool = proj_fold / pool_fold if pool_fold else float("nan")

        pool_ex_boss = ((s.get("enemy_total_health_spawned") or 0) - boss_hp) / base_pool_ex_boss
        vs_pool_ex = proj_fold / pool_ex_boss if pool_ex_boss else float("nan")

        wave_label = f"{wave}*" if is_boss_wave else str(wave)
        print(f"{wave_label:>5}  {proj_fold:>9.2f}x  {curve_fold:>10.2f}x  "
              f"{pool_fold:>9.2f}x  {vs_curve:>8.2f}x  {vs_pool:>7.2f}x  "
              f"{pool_ex_boss:>12.2f}x  {vs_pool_ex:>10.2f}x")

    print("\n* = scheduled boss wave (pool_fold/vs_pool include the boss; "
          "pool_ex_boss/vs_pool_ex strip it out)")


if __name__ == "__main__":
    main()
