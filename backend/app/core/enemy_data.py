"""
Enemy roster data for wave validation: base stats intrinsic to each enemy type.
Matches frontend/src/game/entities/enemies/*.ts (each enemy's SetDefaults()).

Wave-scaling curves (health/damage multipliers, spawn counts/weights) are NOT
here — they live in the app.core.difficulty package, mirroring the frontend's
own separation between per-enemy stats and the Difficulty abstraction.

Game data is loaded from JSON files in app/core/data/ for better modularity.
Keep these data files in sync with the frontend whenever enemy values change.
"""

from typing import Dict, List, Any, Set
import json
from pathlib import Path

from app.core.difficulty.base import Difficulty

def _load_enemy_data() -> tuple[
    Dict[str, int],
    Dict[str, int],
    Dict[str, int],
    Dict[str, float],
    float,
    Set[int],
    Set[str],
    Dict[str, List[str]],
    Dict[str, float]
]:
    data_path = Path(__file__).parent / "data" / "enemies.json"
    with open(data_path) as f:
        data = json.load(f)

    base_health = data["base_health"]
    base_damage = data["base_damage"]
    min_wave = data["min_wave"]
    score_chance = data["score_chance"]
    hexagon_ratio = data["hexagon_shield_ratio"]
    boss_waves = set(data["boss_waves"])
    boss_only = set(data["boss_only_enemies"])
    splits_into = data.get("splits_into", {})
    bundle_drop_chance = data.get("bundle_drop_chance", {})

    return (
        base_health,
        base_damage,
        min_wave,
        score_chance,
        hexagon_ratio,
        boss_waves,
        boss_only,
        splits_into,
        bundle_drop_chance,
    )

(
    ENEMY_BASE_HEALTH,
    ENEMY_BASE_DAMAGE,
    ENEMY_MIN_WAVE,
    ENEMY_SCORE_CHANCE,
    HEXAGON_SHIELD_RATIO,
    BOSS_WAVES,
    BOSS_ONLY_ENEMIES,
    ENEMY_SPLITS_INTO,
    ENEMY_BUNDLE_DROP_CHANCE,
) = _load_enemy_data()


def get_enemy_health(enemy_type: str, wave: int, difficulty: Difficulty) -> int:
    """
    Calculate enemy health for a given wave.

    Args:
        enemy_type: Type of enemy (triangle, square, etc.)
        wave: Current wave number (1-indexed)
        difficulty: Active difficulty, providing the wave-scaling curve

    Returns:
        Scaled health value for the enemy
    """
    base_health = ENEMY_BASE_HEALTH.get(enemy_type, 70)

    # Wave multiplier is calculated with (wave - 1) per WaveManager.ts:31
    multiplier = difficulty.get_health_multiplier(wave - 1)

    scaled_health = base_health * multiplier
    return int(scaled_health)


def calculate_minimum_damage_required(wave: int, enemy_counts: Dict[str, int], difficulty: Difficulty) -> int:
    """
    Calculate minimum damage required to clear a wave.

    Args:
        wave: Wave number
        enemy_counts: Dict mapping enemy_type -> count killed
        difficulty: Active difficulty, providing the wave-scaling curve

    Returns:
        Minimum damage required to kill all enemies
    """
    total_damage = 0

    for enemy_type, count in enemy_counts.items():
        enemy_health = get_enemy_health(enemy_type, wave, difficulty)

        # Hexagons (and super hexagons, same shield mechanic) must also break their shield before the body is vulnerable.
        if enemy_type in ("hexagon", "super_hexagon"):
            shield_health = int(enemy_health * HEXAGON_SHIELD_RATIO)
            total_damage += (enemy_health + shield_health) * count
        else:
            total_damage += enemy_health * count

    return total_damage


def calculate_expected_health_spawned(wave: int, difficulty: Difficulty) -> int:
    """
    Expected total enemy health a wave puts on the field, for the GameRun
    analytics snapshot (enemy_total_health_spawned) - the denominator of the
    "damage dealt vs. health spawned" balancing ratio.

    Built from the same building blocks collect_upgrade_bundle uses for its
    expected-bundle math: the wave's spawn count distributed across its spawn
    weights, each type's share priced at its wave-scaled health. Counts what
    actually has to be chewed through, so it includes hexagon-family shields
    (mirroring calculate_minimum_damage_required) and each expected enemy's
    deterministic split children (Octogon always spawns 2 squares on death -
    real spawned health that isn't in the raw spawn count, same reasoning as
    _validate_kills' split_bonus; one level deep, no current enemy chains
    splits). Scheduled boss spawns are added on top since they also spawn
    outside the regular pool.
    """
    def effective_health(enemy_type: str) -> float:
        health = float(get_enemy_health(enemy_type, wave, difficulty))
        if enemy_type in ("hexagon", "super_hexagon"):
            health += int(health * HEXAGON_SHIELD_RATIO)
        for child in get_split_children(enemy_type):
            child_health = float(get_enemy_health(child, wave, difficulty))
            if child in ("hexagon", "super_hexagon"):
                child_health += int(child_health * HEXAGON_SHIELD_RATIO)
            health += child_health
        return health

    enemy_count = difficulty.get_enemy_count(wave)
    spawn_weights = difficulty.get_spawn_weights(wave)
    total_weight = sum(w["weight"] for w in spawn_weights) or 1.0

    total = sum(
        enemy_count * (w["weight"] / total_weight) * effective_health(w["type"])
        for w in spawn_weights
    )
    total += sum(
        effective_health(boss_type)
        for boss_type in (difficulty.get_scheduled_boss_spawns(wave) or [])
    )
    return int(total)


def get_enemy_score_chance(enemy_type: str) -> float:
    """
    Chance (0-1) that a kill of this enemy type drops score, mirroring each
    enemy's `scoreChance` in frontend/src/game/entities/enemies/*.ts. Defaults
    to 0.0 for unknown types (defensive only; callers only iterate enemy_deaths
    entries already passed through validate_enemy_spawn).
    """
    return ENEMY_SCORE_CHANCE.get(enemy_type, 0.0)


def get_enemy_bundle_drop_chance(enemy_type: str, difficulty: Difficulty, wave: int) -> float:
    """
    Per-kill chance (0-1) this enemy type drops an upgrade bundle, mirroring
    each enemy's own `bundleDropChance` in frontend/src/game/entities/enemies/*.ts.
    Falls back to difficulty.get_bundle_drop_chance(wave) for any enemy type
    with no chance of its own (0 or missing) - mirrors MainScene.ts's
    `data.bundleDropChance > 0 ? data.bundleDropChance : this.waveManager.getBundleDropChance()`.
    """
    chance = ENEMY_BUNDLE_DROP_CHANCE.get(enemy_type, 0.0)
    return chance if chance > 0 else difficulty.get_bundle_drop_chance(wave)


def get_split_children(enemy_type: str) -> List[str]:
    """
    Enemy types spawned when `enemy_type` dies, mirroring each enemy's own
    OnDeath() (e.g. Octogon.ts always spawns exactly 2 'square' on death, no
    RNG involved). Each split child is itself a real, separately-killable
    enemy that legitimately inflates a wave's total kill count beyond its
    raw spawn count - see WaveService._validate_kills, which credits exactly
    these children for every split-parent death actually reported.
    """
    return ENEMY_SPLITS_INTO.get(enemy_type, [])


def validate_enemy_spawn(enemy_type: str, wave: int) -> bool:
    """
    Validate that an enemy type can spawn on a given wave.
    Based on the frontend SPAWN_WEIGHTS / SCHEDULED_BOSS_SPAWNS tables.
    """
    if enemy_type not in ENEMY_BASE_HEALTH:
        return False

    # Boss-only enemies can only appear on scheduled boss waves.
    if enemy_type in BOSS_ONLY_ENEMIES:
        return wave in BOSS_WAVES

    min_wave = ENEMY_MIN_WAVE.get(enemy_type)
    if min_wave is None:
        return False

    return wave >= min_wave
