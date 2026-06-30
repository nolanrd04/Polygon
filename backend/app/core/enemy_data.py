"""
Enemy health and spawn data for wave validation.

This data matches the frontend enemy definitions exactly:
- Base stats: frontend/src/game/entities/enemies/*.ts (each enemy's SetDefaults())
- Wave scaling: frontend/src/game/systems/EnemyManager.ts (Math.exp(wave / 8))
- Spawn rules: frontend/src/game/systems/difficulty/Normal.ts (SPAWN_WEIGHTS / SCHEDULED_BOSS_SPAWNS)

Keep this file in sync with the frontend whenever enemy values change.
"""

from typing import Dict, Any
import math

# Base enemy health values (matches each Enemy class's SetDefaults())
ENEMY_BASE_HEALTH: Dict[str, int] = {
    "triangle": 70,
    "square": 200,
    "super_triangle": 120,
    "super_square": 230,
    "pentagon": 550,
    "hexagon": 800,
    "diamond": 250,
    "octogon": 1500,
    "dodecahedron": 8000,
}

# Base contact damage per enemy (currently unused for validation, kept for parity).
ENEMY_BASE_DAMAGE: Dict[str, int] = {
    "triangle": 35,
    "square": 75,
    "super_triangle": 50,
    "super_square": 30,
    "pentagon": 80,
    "hexagon": 100,
    "diamond": 65,
    "octogon": 100,
    "dodecahedron": 130,
}

# Hexagon's shield is sized as a fraction of its (scaled) health.
# Source: frontend/src/game/entities/enemies/Hexagon.ts (this.maxShieldHealth = this.health * 0.65)
HEXAGON_SHIELD_RATIO: float = 0.65

# Enemy defense values — reduce incoming damage by this flat amount (minimum 1 damage per hit).
# Source: frontend/src/game/entities/enemies/Enemy.ts + subclasses
ENEMY_BASE_DEFENSE: Dict[str, int] = {
    "triangle": 0,
    "square": 0,
    "super_triangle": 0,
    "super_square": 0,
    "pentagon": 0,
    "hexagon": 0,
    "diamond": 0,
    "octogon": 0,
    "dodecahedron": 25,  # Boss has defensive armor
}

# Upgrade bundle drop chance on death (0.0 = 0%, 1.0 = 100%).
# Source: frontend/src/game/entities/enemies/Enemy.ts (bundleDropChance property)
ENEMY_BUNDLE_DROP_CHANCE: Dict[str, float] = {
    "triangle": 0.08,
    "square": 0.1,
    "super_triangle": 0.1,
    "super_square": 0.15,
    "pentagon": 0.12,
    "hexagon": 0.16,
    "diamond": 0.1,
    "octogon": 0.12,
    "dodecahedron": 1.0,  # Boss always drops bundles (custom DropBundles() on frontend)
}

# Earliest wave each enemy can spawn on. Boss-only enemies use the boss-wave value.
# Source: SPAWN_WEIGHTS / SCHEDULED_BOSS_SPAWNS in Normal.ts.
ENEMY_MIN_WAVE: Dict[str, int] = {
    "triangle": 1,
    "square": 3,
    "super_triangle": 5,
    "pentagon": 7,
    "diamond": 8,
    "hexagon": 10,        # boss waves 10/20/30, regular pool from wave 11
    "octogon": 15,
    "super_square": 17,
    "dodecahedron": 10,   # boss-only on waves 10, 20, 30
}

# Waves on which boss-only enemies are scheduled.
# Source: SCHEDULED_BOSS_SPAWNS in Normal.ts.
BOSS_WAVES = {10, 20, 30}
BOSS_ONLY_ENEMIES = {"dodecahedron"}


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
