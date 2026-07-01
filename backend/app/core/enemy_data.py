"""
Enemy health and spawn data for wave validation.

This data matches the frontend enemy definitions exactly:
- Base stats: frontend/src/game/entities/enemies/*.ts (each enemy's SetDefaults())
- Wave scaling: frontend/src/game/systems/EnemyManager.ts (Math.exp(wave / 8))
- Spawn rules: frontend/src/game/systems/difficulty/Normal.ts (SPAWN_WEIGHTS / SCHEDULED_BOSS_SPAWNS)

Game data is loaded from JSON files in app/core/data/ for better modularity.
Keep these data files in sync with the frontend whenever enemy values change.
"""

from typing import Dict, Any, Set
import json
import math
from pathlib import Path

def _load_enemy_data() -> tuple[
    Dict[str, int],
    Dict[str, int],
    Dict[str, int],
    Dict[str, float],
    Dict[str, int],
    float,
    Set[int],
    Set[str]
]:
    data_path = Path(__file__).parent / "data" / "enemies.json"
    with open(data_path) as f:
        data = json.load(f)

    base_health = data["base_health"]
    base_damage = data["base_damage"]
    base_defense = data["base_defense"]
    bundle_drop = data["bundle_drop_chance"]
    min_wave = data["min_wave"]
    hexagon_ratio = data["hexagon_shield_ratio"]
    boss_waves = set(data["boss_waves"])
    boss_only = set(data["boss_only_enemies"])

    return (
        base_health,
        base_damage,
        base_defense,
        bundle_drop,
        min_wave,
        hexagon_ratio,
        boss_waves,
        boss_only,
    )

(
    ENEMY_BASE_HEALTH,
    ENEMY_BASE_DAMAGE,
    ENEMY_BASE_DEFENSE,
    ENEMY_BUNDLE_DROP_CHANCE,
    ENEMY_MIN_WAVE,
    HEXAGON_SHIELD_RATIO,
    BOSS_WAVES,
    BOSS_ONLY_ENEMIES,
) = _load_enemy_data()


def get_wave_multiplier(wave: int) -> float:
    """
    Calculate wave multiplier for enemy stats.
    Matches frontend EnemyManager.ts:206  ->  Math.exp(wave / 8)
    Note: wave parameter should be (currentWave - 1) as done in WaveManager.ts:31.
    """
    return math.exp(wave / 8)


def get_enemy_health(enemy_type: str, wave: int) -> int:
    """
    Calculate enemy health for a given wave.

    Args:
        enemy_type: Type of enemy (triangle, square, etc.)
        wave: Current wave number (1-indexed)

    Returns:
        Scaled health value for the enemy
    """
    base_health = ENEMY_BASE_HEALTH.get(enemy_type, 70)

    # Wave multiplier is calculated with (wave - 1) per WaveManager.ts:31
    multiplier = get_wave_multiplier(wave - 1)

    scaled_health = base_health * multiplier
    return int(scaled_health)


def calculate_minimum_damage_required(wave: int, enemy_counts: Dict[str, int]) -> int:
    """
    Calculate minimum damage required to clear a wave.

    Args:
        wave: Wave number
        enemy_counts: Dict mapping enemy_type -> count killed

    Returns:
        Minimum damage required to kill all enemies
    """
    total_damage = 0

    for enemy_type, count in enemy_counts.items():
        enemy_health = get_enemy_health(enemy_type, wave)

        # Hexagons must also break their shield before the body is vulnerable.
        if enemy_type == "hexagon":
            shield_health = int(enemy_health * HEXAGON_SHIELD_RATIO)
            total_damage += (enemy_health + shield_health) * count
        else:
            total_damage += enemy_health * count

    return total_damage


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
