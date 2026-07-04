"""
Upgrade Registry

This module imports all upgrade implementations and exposes them via a registry.
Backend code can access upgrades via: get_upgrade("upgrade_id")
"""

from .upgrade_implementation import UpgradeImplementation

# Stat Modifiers
from .stat_modifiers.damage_1 import Damage1
from .stat_modifiers.damage_2 import Damage2
from .stat_modifiers.damage_3 import Damage3
from .stat_modifiers.damage_4 import Damage4
from .stat_modifiers.damage_5 import Damage5
from .stat_modifiers.bullet_damage_1 import BulletDamage1
from .stat_modifiers.bullet_damage_2 import BulletDamage2
from .stat_modifiers.bullet_damage_3 import BulletDamage3
from .stat_modifiers.bullet_damage_4 import BulletDamage4
from .stat_modifiers.bullet_damage_5 import BulletDamage5
from .stat_modifiers.bullet_speed_1 import BulletSpeed1
from .stat_modifiers.bullet_pierce_1 import BulletPierce1
from .stat_modifiers.bullet_size_1 import BulletSize1
from .stat_modifiers.bullet_size_2 import BulletSize2
from .stat_modifiers.player_health_1 import PlayerHealth1
from .stat_modifiers.player_health_2 import PlayerHealth2
from .stat_modifiers.player_health_3 import PlayerHealth3
from .stat_modifiers.player_health_4 import PlayerHealth4
from .stat_modifiers.player_health_5 import PlayerHealth5
from .stat_modifiers.knockback_1 import Knockback1
from .stat_modifiers.knockback_2 import Knockback2
from .stat_modifiers.knockback_3 import Knockback3
from .stat_modifiers.player_speed_1 import PlayerSpeed1
from .stat_modifiers.polygon_upgrade import PolygonUpgrade
from .stat_modifiers.explosion_radius import ExplosionRadius
from .stat_modifiers.explosion_damage_1 import ExplosionDamage1
from .stat_modifiers.explosion_damage_2 import ExplosionDamage2
from .stat_modifiers.explosion_damage_3 import ExplosionDamage3
from .stat_modifiers.explosion_damage_percent_1 import ExplosionDamagePercent1
from .stat_modifiers.explosion_damage_percent_2 import ExplosionDamagePercent2
from .stat_modifiers.homing_distance_1 import HomingDistance1
from .stat_modifiers.homing_distance_2 import HomingDistance2
from .stat_modifiers.minimum_homing_damage_multiplier_1 import MinimumHomingDamageMultiplier1
from .stat_modifiers.minimum_homing_damage_multiplier_2 import MinimumHomingDamageMultiplier2
from .stat_modifiers.tenacity_1 import Tenacity1
from .stat_modifiers.tenacity_2 import Tenacity2
from .stat_modifiers.tenacity_3 import Tenacity3
from .stat_modifiers.dash_speed_1 import DashSpeed1
from .stat_modifiers.dash_speed_2 import DashSpeed2
from .stat_modifiers.dash_cooldown_1 import DashCooldown1
from .stat_modifiers.dash_cooldown_2 import DashCooldown2

# Effects
from .effects.vampirism_1 import Vampirism1
from .effects.vampirism_2 import Vampirism2
from .effects.vampirism_3 import Vampirism3
from .effects.armor import Armor
from .effects.armor_2 import Armor2
from .effects.thorns import Thorns
from .effects.explosion_on_kill import ExplosionOnKill
from .effects.ricochet import Ricochet
from .effects.regeneration import Regeneration

# Variants
from .variants.homing_bullets import HomingBullets
from .variants.explosive_bullets import ExplosiveBullets

# Abilities
from .abilities.dash_ability import DashAbility
from .abilities.shield_ability import ShieldAbility
from .abilities.double_dash import DoubleDash
from .abilities.triple_dash import TripleDash

# Curses
from .curses.damage_reduc_1 import DamageReduc1
from .curses.damage_reduc_2 import DamageReduc2
from .curses.damage_reduc_3 import DamageReduc3
from .curses.damage_reduc_4 import DamageReduc4
from .curses.damage_reduc_5 import DamageReduc5
from .curses.shattered_bullet_1 import ShatteredBullet1
from .curses.shattered_bullet_2 import ShatteredBullet2
from .curses.shattered_bullet_3 import ShatteredBullet3
from .curses.health_reduc_1 import HealthReduc1
from .curses.health_reduc_2 import HealthReduc2
from .curses.health_reduc_3 import HealthReduc3
from .curses.health_reduc_4 import HealthReduc4
from .curses.health_reduc_5 import HealthReduc5
from .curses.fragility_1 import Fragility1
from .curses.fragility_2 import Fragility2

UPGRADE_REGISTRY = {
    # Stat Modifiers
    'damage_1': Damage1(),
    'damage_2': Damage2(),
    'damage_3': Damage3(),
    'damage_4': Damage4(),
    'damage_5': Damage5(),
    'bullet_damage_1': BulletDamage1(),
    'bullet_damage_2': BulletDamage2(),
    'bullet_damage_3': BulletDamage3(),
    'bullet_damage_4': BulletDamage4(),
    'bullet_damage_5': BulletDamage5(),
    'bullet_speed_1': BulletSpeed1(),
    'bullet_pierce_1': BulletPierce1(),
    'bullet_size_1': BulletSize1(),
    'bullet_size_2': BulletSize2(),
    'player_health_1': PlayerHealth1(),
    'player_health_2': PlayerHealth2(),
    'player_health_3': PlayerHealth3(),
    'player_health_4': PlayerHealth4(),
    'player_health_5': PlayerHealth5(),
    'knockback_1': Knockback1(),
    'knockback_2': Knockback2(),
    'knockback_3': Knockback3(),
    'player_speed_1': PlayerSpeed1(),
    'polygon_upgrade': PolygonUpgrade(),
    'explosion_radius': ExplosionRadius(),
    'explosion_damage_1': ExplosionDamage1(),
    'explosion_damage_2': ExplosionDamage2(),
    'explosion_damage_3': ExplosionDamage3(),
    'explosion_damage_percent_1': ExplosionDamagePercent1(),
    'explosion_damage_percent_2': ExplosionDamagePercent2(),
    'homing_distance_1': HomingDistance1(),
    'homing_distance_2': HomingDistance2(),
    'minimum_homing_damage_multiplier_1': MinimumHomingDamageMultiplier1(),
    'minimum_homing_damage_multiplier_2': MinimumHomingDamageMultiplier2(),
    'tenacity_1': Tenacity1(),
    'tenacity_2': Tenacity2(),
    'tenacity_3': Tenacity3(),
    'dash_speed_1': DashSpeed1(),
    'dash_speed_2': DashSpeed2(),
    'dash_cooldown_1': DashCooldown1(),
    'dash_cooldown_2': DashCooldown2(),

    # Effects
    'vampirism_1': Vampirism1(),
    'vampirism_2': Vampirism2(),
    'vampirism_3': Vampirism3(),
    'armor': Armor(),
    'armor_2': Armor2(),
    'thorns': Thorns(),
    'explosion_on_kill': ExplosionOnKill(),
    'ricochet': Ricochet(),
    'regeneration': Regeneration(),

    # Variants
    'homing_bullets': HomingBullets(),
    'explosive_bullets': ExplosiveBullets(),

    # Abilities
    'dash_ability': DashAbility(),
    'shield_ability': ShieldAbility(),
    'double_dash': DoubleDash(),
    'triple_dash': TripleDash(),

    # Curses
    'damage_reduc_1': DamageReduc1(),
    'damage_reduc_2': DamageReduc2(),
    'damage_reduc_3': DamageReduc3(),
    'damage_reduc_4': DamageReduc4(),
    'damage_reduc_5': DamageReduc5(),
    'shattered_bullet_1': ShatteredBullet1(),
    'shattered_bullet_2': ShatteredBullet2(),
    'shattered_bullet_3': ShatteredBullet3(),
    'health_reduc_1': HealthReduc1(),
    'health_reduc_2': HealthReduc2(),
    'health_reduc_3': HealthReduc3(),
    'health_reduc_4': HealthReduc4(),
    'health_reduc_5': HealthReduc5(),
    'fragility_1': Fragility1(),
    'fragility_2': Fragility2(),
}


def get_upgrade(upgrade_id: str) -> UpgradeImplementation | None:
    """Get an upgrade implementation by ID"""
    return UPGRADE_REGISTRY.get(upgrade_id)


def get_all_upgrades() -> list[UpgradeImplementation]:
    """Get all registered upgrade implementations"""
    return list(UPGRADE_REGISTRY.values())
