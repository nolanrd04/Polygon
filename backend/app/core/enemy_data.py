"""
Enemy health and spawn data for wave validation.
This data matches the frontend enemy definitions exactly.
"""

from typing import Dict, Any
import math

# Base enemy health values (matches frontend SetDefaults())
ENEMY_BASE_HEALTH: Dict[str, int] = {
    "triangle": 70,
    "square": 110,
    "pentagon": 250,
    "hexagon": 575,
    "shooter": 45,
}

def get_wave_multiplier(wave: int) -> float:
    """
    Calculate wave multiplier for enemy stats.
    Matches frontend: Math.exp(wave / 6)
    Note: wave parameter should be (currentWave - 1) as done in WaveManager.ts:32
    """
    return math.exp(wave / 6)


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

    # Wave multiplier is calculated with (wave - 1) as per WaveManager.ts:32
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

        # Special case for hexagon - they have shields
        if enemy_type == "hexagon":
            # Shield health is 65% of base health (from Hexagon.ts:72)
            shield_health = int(enemy_health * 0.65)
            total_damage += (enemy_health + shield_health) * count
        else:
            total_damage += enemy_health * count

    return total_damage


def validate_enemy_spawn(enemy_type: str, wave: int) -> bool:
    """
    Validate that an enemy type can spawn on a given wave.
    Based on frontend spawn rules.
    """
    if enemy_type not in ENEMY_BASE_HEALTH:
        return False

    # Basic validation - hexagons and shooters spawn later
    # TODO: Add more specific spawn rules based on WaveManager if needed
    if enemy_type == "hexagon" and wave < 5:
        return False

    if enemy_type == "shooter" and wave < 3:
        return False

    return True


