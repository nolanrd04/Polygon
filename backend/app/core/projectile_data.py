"""
Projectile data for wave validation: the mechanically-relevant fields each
projectile class sets in its own SetDefaults()
(frontend/src/game/entities/projectiles/player_projectiles/*.ts) - damage,
speed, pierce, fire-rate cooldown, and (for buckshot) pellet count. Deliberately
excludes purely cosmetic/hitbox fields (size, color, sounds) and fields that
are dynamic at runtime rather than fixed constants (e.g. Spinner's
`size = this.radius`), since nothing here reads them.

Only `bullet` is currently selectable in-game (see
frontend/src/pages/AttackSelectPage.tsx's implementedAttacks), but the other
attack types already have real values defined for when they ship.
`HeavyBullet` is a real projectile class with its own values but has no
upgrade path that can currently select it (dead content) - deliberately
omitted here until something makes it reachable.

Keep this data file in sync with the frontend whenever a projectile's stats
change, same as app/core/data/enemies.json / upgrades.json.
"""

import json
from pathlib import Path
from typing import Any, Dict, List, Tuple

DEFAULT_PROJECTILE = "bullet"

# Mutually exclusive bullet-variant upgrades (see incompatibleWith/replaces in
# app/core/data/upgrades.json) - mirrors Player.ts's getBulletVariantClass(),
# which reads UpgradeSystem.getVariant(UpgradeTargetID.Bullet).
BULLET_VARIANT_UPGRADES = ["homing_bullets", "explosive_bullets", "buckshot_bullets"]


def _load_projectile_data() -> Dict[str, Dict[str, Any]]:
    data_path = Path(__file__).parent / "data" / "projectiles.json"
    with open(data_path) as f:
        return json.load(f)


PROJECTILES = _load_projectile_data()


def resolve_active_projectile(attack_type: str, current_upgrades: List[str]) -> str:
    """
    Mirrors Player.ts's getActiveProjectileClass()/getBulletVariantClass():
    for attack_type == "bullet", the concrete projectile is whichever
    variant upgrade the player owns (mutually exclusive), else the base
    bullet. Other attack types have no variant concept yet, so they resolve
    directly to their own attack_type.
    """
    if attack_type != "bullet":
        return attack_type

    for variant_upgrade in BULLET_VARIANT_UPGRADES:
        if variant_upgrade in current_upgrades:
            return variant_upgrade

    return DEFAULT_PROJECTILE


def _get(projectile: str) -> Dict[str, Any]:
    return PROJECTILES.get(projectile, PROJECTILES[DEFAULT_PROJECTILE])


def get_fire_cooldown_ms(projectile: str) -> float:
    """Fire-rate cooldown, in ms, for the given resolved projectile."""
    return _get(projectile)["cooldown_ms"]


def get_base_damage(projectile: str) -> float:
    """Base per-hit damage (pre-upgrade) for the given resolved projectile."""
    return _get(projectile)["damage"]


def get_base_pierce(projectile: str) -> int:
    """Base unique-enemies-hit-per-projectile (pre-upgrade)."""
    return _get(projectile)["pierce"]


def get_pellet_range(projectile: str) -> Tuple[int, int]:
    """(min, max) pellets per discharge. (1, 1) for non-buckshot projectiles."""
    data = _get(projectile)
    return data.get("min_pellets", 1), data.get("max_pellets", 1)


def get_pellet_damage_fraction(projectile: str) -> float:
    """
    Fraction of the resolved bullet damage each pellet actually deals
    (BuckshotBullet.OnSpawn(): `pellet.damage = this.damage * <fraction>`,
    applied AFTER upgrade modifiers, not before). 1.0 for non-buckshot
    projectiles, where a single hit deals the full resolved damage.
    """
    return _get(projectile).get("pellet_damage_fraction", 1.0)


def get_explosion_defaults() -> Dict[str, Any]:
    """Base damage/radius for BulletExplosion (explosive_bullets impact)."""
    return PROJECTILES["explosion"]
