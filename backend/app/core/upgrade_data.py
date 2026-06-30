"""
Upgrade definitions for backend upgrade rolling and validation.
This matches the frontend upgrade JSON files in
frontend/src/game/data/upgrades/.

Per-wave rarity weights mirror the frontend Difficulty implementation
(frontend/src/game/systems/difficulty/Normal.ts — getRarityWeights).
Keep this file in sync with the frontend whenever upgrade values change.
"""

from typing import Dict, List, Any

# Per-wave rarity weights for upgrade rolls. Each row sums to 1.
# Mirror of RARITY_WEIGHTS_BY_WAVE in frontend/src/game/systems/difficulty/Normal.ts.
RARITY_WEIGHTS_BY_WAVE: Dict[int, Dict[str, float]] = {
    1:  {"common": 0.50, "uncommon": 0.35, "rare": 0.15, "epic": 0.00, "legendary": 0.00},
    2:  {"common": 0.50, "uncommon": 0.35, "rare": 0.15, "epic": 0.00, "legendary": 0.00},
    3:  {"common": 0.48, "uncommon": 0.36, "rare": 0.16, "epic": 0.00, "legendary": 0.00},
    4:  {"common": 0.45, "uncommon": 0.38, "rare": 0.17, "epic": 0.00, "legendary": 0.00},
    5:  {"common": 0.44, "uncommon": 0.36, "rare": 0.16, "epic": 0.04, "legendary": 0.00},
    6:  {"common": 0.42, "uncommon": 0.36, "rare": 0.18, "epic": 0.04, "legendary": 0.00},
    7:  {"common": 0.41, "uncommon": 0.37, "rare": 0.18, "epic": 0.04, "legendary": 0.00},
    8:  {"common": 0.40, "uncommon": 0.38, "rare": 0.18, "epic": 0.04, "legendary": 0.00},
    9:  {"common": 0.38, "uncommon": 0.38, "rare": 0.19, "epic": 0.05, "legendary": 0.00},
    10: {"common": 0.37, "uncommon": 0.38, "rare": 0.19, "epic": 0.05, "legendary": 0.01},
    11: {"common": 0.34, "uncommon": 0.40, "rare": 0.20, "epic": 0.05, "legendary": 0.01},
    12: {"common": 0.32, "uncommon": 0.41, "rare": 0.21, "epic": 0.05, "legendary": 0.01},
    13: {"common": 0.31, "uncommon": 0.42, "rare": 0.21, "epic": 0.05, "legendary": 0.01},
    14: {"common": 0.29, "uncommon": 0.42, "rare": 0.22, "epic": 0.06, "legendary": 0.01},
    15: {"common": 0.28, "uncommon": 0.43, "rare": 0.22, "epic": 0.06, "legendary": 0.01},
    16: {"common": 0.28, "uncommon": 0.41, "rare": 0.23, "epic": 0.06, "legendary": 0.02},
    17: {"common": 0.28, "uncommon": 0.40, "rare": 0.23, "epic": 0.07, "legendary": 0.02},
    18: {"common": 0.26, "uncommon": 0.41, "rare": 0.24, "epic": 0.07, "legendary": 0.02},
    19: {"common": 0.25, "uncommon": 0.41, "rare": 0.25, "epic": 0.07, "legendary": 0.02},
    20: {"common": 0.24, "uncommon": 0.40, "rare": 0.25, "epic": 0.08, "legendary": 0.03},
    21: {"common": 0.24, "uncommon": 0.39, "rare": 0.26, "epic": 0.08, "legendary": 0.03},
    22: {"common": 0.24, "uncommon": 0.38, "rare": 0.27, "epic": 0.08, "legendary": 0.03},
    23: {"common": 0.23, "uncommon": 0.37, "rare": 0.28, "epic": 0.09, "legendary": 0.03},
    24: {"common": 0.22, "uncommon": 0.37, "rare": 0.29, "epic": 0.09, "legendary": 0.03},
    25: {"common": 0.22, "uncommon": 0.36, "rare": 0.30, "epic": 0.09, "legendary": 0.03},
    26: {"common": 0.21, "uncommon": 0.36, "rare": 0.30, "epic": 0.09, "legendary": 0.04},
    27: {"common": 0.20, "uncommon": 0.35, "rare": 0.31, "epic": 0.10, "legendary": 0.04},
    28: {"common": 0.20, "uncommon": 0.34, "rare": 0.32, "epic": 0.10, "legendary": 0.04},
    29: {"common": 0.20, "uncommon": 0.33, "rare": 0.32, "epic": 0.11, "legendary": 0.04},
    30: {"common": 0.20, "uncommon": 0.31, "rare": 0.33, "epic": 0.11, "legendary": 0.05},
}

FALLBACK_RARITY_WEIGHTS: Dict[str, float] = {
    "common": 0.20, "uncommon": 0.31, "rare": 0.33, "epic": 0.11, "legendary": 0.05,
}


def get_rarity_weights(wave: int) -> Dict[str, float]:
    return RARITY_WEIGHTS_BY_WAVE.get(wave, FALLBACK_RARITY_WEIGHTS)

# All upgrades - complete database
UPGRADES: Dict[str, Dict[str, Any]] = {
    # STAT UPGRADES
    "damage_1": {"id": "damage_1", "name": "Devastation", "description": "+0.2% damage.", "rarity": "common", "type": "stat_modifier", "target": "attack", "stat": "damage", "value": 0.002, "isMultiplier": True, "stackable": True, "maxStacks": 99999, "cost": 2},
    "damage_2": {"id": "damage_2", "name": "Devastation", "description": "+0.8% damage.", "rarity": "uncommon", "type": "stat_modifier", "target": "attack", "stat": "damage", "value": 0.008, "isMultiplier": True, "stackable": True, "maxStacks": 99999, "cost": 6},
    "damage_3": {"id": "damage_3", "name": "Devastation", "description": "+1.6% damage.", "rarity": "rare", "type": "stat_modifier", "target": "attack", "stat": "damage", "value": 0.016, "isMultiplier": True, "stackable": True, "maxStacks": 99999, "cost": 10},
    "damage_4": {"id": "damage_4", "name": "Devastation", "description": "+3.5% damage.", "rarity": "epic", "type": "stat_modifier", "target": "attack", "stat": "damage", "value": 0.035, "isMultiplier": True, "stackable": True, "maxStacks": 99999, "cost": 20},
    "damage_5": {"id": "damage_5", "name": "Devastation", "description": "+7.5% damage.", "rarity": "legendary", "type": "stat_modifier", "target": "attack", "stat": "damage", "value": 0.075, "isMultiplier": True, "stackable": True, "maxStacks": 99999, "cost": 40},

    "bullet_damage_1": {"id": "bullet_damage_1", "name": "Sharper Rounds", "description": "+1 bullet damage", "rarity": "common", "type": "stat_modifier", "target": "attack", "attackType": "bullet", "stat": "damage", "value": 1, "isMultiplier": False, "stackable": True, "maxStacks": 99999, "cost": 2},
    "bullet_damage_2": {"id": "bullet_damage_2", "name": "Sharper Rounds", "description": "+4 bullet damage", "rarity": "uncommon", "type": "stat_modifier", "target": "attack", "attackType": "bullet", "stat": "damage", "value": 4, "isMultiplier": False, "stackable": True, "maxStacks": 99999, "cost": 6},
    "bullet_damage_3": {"id": "bullet_damage_3", "name": "Sharper Rounds", "description": "+8 bullet damage", "rarity": "rare", "type": "stat_modifier", "target": "attack", "attackType": "bullet", "stat": "damage", "value": 8, "isMultiplier": False, "stackable": True, "maxStacks": 99999, "cost": 10},
    "bullet_damage_4": {"id": "bullet_damage_4", "name": "Sharper Rounds", "description": "+16 bullet damage", "rarity": "epic", "type": "stat_modifier", "target": "attack", "attackType": "bullet", "stat": "damage", "value": 16, "isMultiplier": False, "stackable": True, "maxStacks": 99999, "cost": 20},
    "bullet_damage_5": {"id": "bullet_damage_5", "name": "Sharper Rounds", "description": "+35 bullet damage", "rarity": "legendary", "type": "stat_modifier", "target": "attack", "attackType": "bullet", "stat": "damage", "value": 35, "isMultiplier": False, "stackable": True, "maxStacks": 99999, "cost": 40},

    "bullet_speed_1": {"id": "bullet_speed_1", "name": "Velocity Boost", "description": "+5% bullet speed", "rarity": "common", "type": "stat_modifier", "target": "bullet", "attackType": "bullet", "stat": "speed", "value": 0.05, "isMultiplier": True, "stackable": True, "maxStacks": 5, "cost": 2},

    "bullet_pierce_1": {"id": "bullet_pierce_1", "name": "Piercing Shot", "description": "Bullets pierce +1 enemy", "rarity": "rare", "type": "stat_modifier", "target": "bullet", "attackType": "bullet", "stat": "pierce", "value": 1, "stackable": True, "maxStacks": 2, "cost": 10},

    "bullet_size_1": {"id": "bullet_size_1", "name": "Heavy Rounds", "description": "+10% bullet size", "rarity": "uncommon", "type": "stat_modifier", "target": "bullet", "attackType": "bullet", "stat": "size", "value": 0.10, "isMultiplier": True, "stackable": True, "maxStacks": 3, "cost": 6},
    "bullet_size_2": {"id": "bullet_size_2", "name": "Heavy Rounds", "description": "+25% bullet size", "rarity": "rare", "type": "stat_modifier", "target": "bullet", "attackType": "bullet", "stat": "size", "value": 0.25, "isMultiplier": True, "stackable": True, "maxStacks": 2, "cost": 10},

    "player_health_1": {"id": "player_health_1", "name": "Reinforced Core", "description": "+10 max health", "rarity": "common", "type": "stat_modifier", "target": "player", "stat": "maxHealth", "value": 10, "stackable": True, "maxStacks": 20, "cost": 2},
    "player_health_2": {"id": "player_health_2", "name": "Reinforced Core", "description": "+30 max health", "rarity": "uncommon", "type": "stat_modifier", "target": "player", "stat": "maxHealth", "value": 30, "stackable": True, "maxStacks": 15, "cost": 6},
    "player_health_3": {"id": "player_health_3", "name": "Reinforced Core", "description": "+60 max health", "rarity": "rare", "type": "stat_modifier", "target": "player", "stat": "maxHealth", "value": 60, "stackable": True, "maxStacks": 10, "cost": 10},
    "player_health_4": {"id": "player_health_4", "name": "Reinforced Core", "description": "+130 max health", "rarity": "epic", "type": "stat_modifier", "target": "player", "stat": "maxHealth", "value": 130, "stackable": True, "maxStacks": 8, "cost": 20},
    "player_health_5": {"id": "player_health_5", "name": "Reinforced Core", "description": "+300 max health", "rarity": "legendary", "type": "stat_modifier", "target": "player", "stat": "maxHealth", "value": 300, "stackable": True, "maxStacks": 5, "cost": 40},

    "knockback_1": {"id": "knockback_1", "name": "Knockback Boost", "description": "+5% knockback", "rarity": "common", "type": "stat_modifier", "target": "attack", "stat": "knockback", "value": 0.05, "isMultiplier": True, "stackable": True, "maxStacks": 5, "cost": 2},
    "knockback_2": {"id": "knockback_2", "name": "Knockback Boost", "description": "+20% knockback", "rarity": "uncommon", "type": "stat_modifier", "target": "attack", "stat": "knockback", "value": 0.20, "isMultiplier": True, "stackable": True, "maxStacks": 3, "cost": 6},
    "knockback_3": {"id": "knockback_3", "name": "Knockback Boost", "description": "+50% knockback", "rarity": "rare", "type": "stat_modifier", "target": "attack", "stat": "knockback", "value": 0.50, "isMultiplier": True, "stackable": True, "maxStacks": 2, "cost": 10},

    "player_speed_1": {"id": "player_speed_1", "name": "Thruster Boost", "description": "+10 movement speed", "rarity": "uncommon", "type": "stat_modifier", "target": "player", "stat": "speed", "value": 10, "stackable": True, "maxStacks": 10, "cost": 6},

    "polygon_upgrade": {"id": "polygon_upgrade", "name": "Evolution", "description": "+1 polygon side", "rarity": "legendary", "type": "stat_modifier", "target": "player", "stat": "polygonSides", "value": 1, "stackable": True, "maxStacks": 9, "cost": 60},

    "explosion_radius": {"id": "explosion_radius", "name": "Blast Radius", "description": "+5 explosion radius", "rarity": "uncommon", "type": "stat_modifier", "target": "bullet", "attackType": "bullet", "stat": "explosionRadius", "value": 5, "stackable": True, "maxStacks": 5, "cost": 6, "dependentOn": ["explosive_bullets", "explosion_on_kill"], "dependencyCount": 1},

    # EXPLOSION DAMAGE
    "explosion_damage_1": {"id": "explosion_damage_1", "name": "Volatile Core", "description": "+5 explosion damage", "rarity": "rare", "type": "stat_modifier", "target": "bullet", "attackType": "bullet", "stat": "explosionDamage", "value": 5, "isMultiplier": False, "stackable": True, "maxStacks": 99999, "cost": 10, "dependentOn": ["explosive_bullets", "explosion_on_kill"], "dependencyCount": 1},
    "explosion_damage_2": {"id": "explosion_damage_2", "name": "Volatile Core", "description": "+11 explosion damage", "rarity": "epic", "type": "stat_modifier", "target": "bullet", "attackType": "bullet", "stat": "explosionDamage", "value": 11, "isMultiplier": False, "stackable": True, "maxStacks": 99999, "cost": 20, "dependentOn": ["explosive_bullets", "explosion_on_kill"], "dependencyCount": 1},
    "explosion_damage_3": {"id": "explosion_damage_3", "name": "Volatile Core", "description": "+25 explosion damage", "rarity": "legendary", "type": "stat_modifier", "target": "bullet", "attackType": "bullet", "stat": "explosionDamage", "value": 25, "isMultiplier": False, "stackable": True, "maxStacks": 99999, "cost": 40, "dependentOn": ["explosive_bullets", "explosion_on_kill"], "dependencyCount": 1},
    "explosion_damage_percent_1": {"id": "explosion_damage_percent_1", "name": "Explosive Force", "description": "+3% explosion damage", "rarity": "epic", "type": "stat_modifier", "target": "bullet", "attackType": "bullet", "stat": "explosionDamage", "value": 0.03, "isMultiplier": True, "stackable": True, "maxStacks": 5, "cost": 20, "dependentOn": ["explosive_bullets", "explosion_on_kill"], "dependencyCount": 1},
    "explosion_damage_percent_2": {"id": "explosion_damage_percent_2", "name": "Explosive Force", "description": "+7% explosion damage", "rarity": "legendary", "type": "stat_modifier", "target": "bullet", "attackType": "bullet", "stat": "explosionDamage", "value": 0.07, "isMultiplier": True, "stackable": True, "maxStacks": 3, "cost": 40, "dependentOn": ["explosive_bullets", "explosion_on_kill"], "dependencyCount": 1},

    # HOMING BULLETS
    "homing_distance_1": {"id": "homing_distance_1", "name": "Enhanced Eyesight", "description": "+20 tracking distance for homing bullets", "rarity": "uncommon", "type": "stat_modifier", "target": "bullet", "attackType": "bullet", "stat": "trackingDistance", "value": 20, "stackable": True, "maxStacks": 6, "cost": 6, "dependentOn": ["homing_bullets"], "dependencyCount": 1},
    "homing_distance_2": {"id": "homing_distance_2", "name": "Enhanced Eyesight", "description": "+50 tracking distance for homing bullets", "rarity": "rare", "type": "stat_modifier", "target": "bullet", "attackType": "bullet", "stat": "trackingDistance", "value": 50, "stackable": True, "maxStacks": 4, "cost": 10, "dependentOn": ["homing_bullets"], "dependencyCount": 1},
    "minimum_homing_damage_multiplier_1": {"id": "minimum_homing_damage_multiplier_1", "name": "Kinetic Amplifier", "description": "Increases the possible damage of homing bullets by 2%", "rarity": "epic", "type": "stat_modifier", "target": "bullet", "attackType": "bullet", "stat": "minimumDamageMultiplier", "value": 0.02, "stackable": True, "maxStacks": 5, "cost": 20, "dependentOn": ["homing_bullets"], "dependencyCount": 1},
    "minimum_homing_damage_multiplier_2": {"id": "minimum_homing_damage_multiplier_2", "name": "Kinetic Amplifier", "description": "Increases the possible damage of homing bullets by 5%", "rarity": "legendary", "type": "stat_modifier", "target": "bullet", "attackType": "bullet", "stat": "minimumDamageMultiplier", "value": 0.05, "stackable": True, "maxStacks": 2, "cost": 40, "dependentOn": ["homing_bullets"], "dependencyCount": 1},

    # TENACITY (BULLET LIFESPAN)
    "tenacity_1": {"id": "tenacity_1", "name": "Tenacity", "description": "Increased the bullet lifespan by .15 seconds", "rarity": "rare", "type": "stat_modifier", "target": "bullet", "attackType": "bullet", "stat": "timeLeft", "value": 150, "stackable": True, "maxStacks": 6, "cost": 10},
    "tenacity_2": {"id": "tenacity_2", "name": "Tenacity", "description": "Increased the bullet lifespan by .4 seconds", "rarity": "epic", "type": "stat_modifier", "target": "bullet", "attackType": "bullet", "stat": "timeLeft", "value": 400, "stackable": True, "maxStacks": 3, "cost": 20},
    "tenacity_3": {"id": "tenacity_3", "name": "Tenacity", "description": "Increased the bullet lifespan by 1 second", "rarity": "legendary", "type": "stat_modifier", "target": "bullet", "attackType": "bullet", "stat": "timeLeft", "value": 1000, "stackable": True, "maxStacks": 1, "cost": 40},

    # DASH SPEED
    "dash_speed_1": {"id": "dash_speed_1", "name": "Swift Escape", "description": "+15% dash speed", "rarity": "rare", "type": "stat_modifier", "target": "player", "stat": "dashSpeed", "value": 0.15, "isMultiplier": True, "stackable": True, "maxStacks": 3, "cost": 10, "dependentOn": ["dash_ability"], "dependencyCount": 1},
    "dash_speed_2": {"id": "dash_speed_2", "name": "Swift Escape", "description": "+32% dash speed", "rarity": "epic", "type": "stat_modifier", "target": "player", "stat": "dashSpeed", "value": 0.32, "isMultiplier": True, "stackable": True, "maxStacks": 2, "cost": 20, "dependentOn": ["dash_ability"], "dependencyCount": 1},

    # DASH COOLDOWN REDUCTION
    "dash_cooldown_1": {"id": "dash_cooldown_1", "name": "Swift Recovery", "description": "-5% dash cooldown", "rarity": "rare", "type": "stat_modifier", "target": "player", "stat": "dashCooldown", "value": -0.05, "isMultiplier": True, "stackable": True, "maxStacks": 5, "cost": 10, "dependentOn": ["dash_ability"], "dependencyCount": 1},
    "dash_cooldown_2": {"id": "dash_cooldown_2", "name": "Swift Recovery", "description": "-15% dash cooldown", "rarity": "epic", "type": "stat_modifier", "target": "player", "stat": "dashCooldown", "value": -0.15, "isMultiplier": True, "stackable": True, "maxStacks": 3, "cost": 20, "dependentOn": ["dash_ability"], "dependencyCount": 1},

    # EFFECT UPGRADES
    "vampirism_1": {"id": "vampirism_1", "name": "Vampirism", "description": "Heal for 2% of damage dealt", "rarity": "rare", "type": "effect", "effect": "lifesteal", "effectValue": 0.02, "stackable": False, "maxStacks": 1, "cost": 10, "tier": 1, "upgradesTo": "vampirism_2"},
    "vampirism_2": {"id": "vampirism_2", "name": "Vampirism", "description": "Heal for 5% of damage dealt", "rarity": "epic", "type": "effect", "effect": "lifesteal", "effectValue": 0.05, "stackable": False, "maxStacks": 1, "cost": 20, "tier": 2, "upgradesTo": "vampirism_3"},
    "vampirism_3": {"id": "vampirism_3", "name": "Vampirism", "description": "Heal for 12% of damage dealt", "rarity": "legendary", "type": "effect", "effect": "lifesteal", "effectValue": 0.12, "stackable": False, "maxStacks": 1, "cost": 40, "tier": 3},

    "regeneration": {"id": "regeneration", "name": "Auto Repair", "description": "Regenerate 1 HP/sec", "rarity": "epic", "type": "effect", "effect": "regen", "effectValue": 1, "stackable": True, "maxStacks": 3, "cost": 20},

    "armor": {"id": "armor", "name": "Hardened Shell", "description": "Reduce incoming damage by 2.5%", "rarity": "rare", "type": "effect", "effect": "protection", "effectValue": 0.025, "multipler": True, "stackable": True, "maxStacks": 5, "cost": 10},
    "armor_2": {"id": "armor_2", "name": "Hardened Shell", "description": "Reduce incoming damage by 6%", "rarity": "epic", "type": "effect", "effect": "protection", "effectValue": 0.06, "multipler": True, "stackable": True, "maxStacks": 3, "cost": 20},

    "thorns": {"id": "thorns", "name": "Thorns", "description": "Reflect 10% of damage taken", "rarity": "epic", "type": "effect", "effect": "thorns", "effectValue": 0.1, "stackable": True, "maxStacks": 3, "cost": 20},

    "explosion_on_kill": {"id": "explosion_on_kill", "name": "Chain Reaction", "description": "Enemies explode on death", "rarity": "epic", "type": "effect", "effect": "explode_on_kill", "effectValue": 20, "stackable": False, "cost": 20},

    "ricochet": {"id": "ricochet", "name": "Ricochet Rounds", "description": "Projectiles bounce off surfaces.", "rarity": "epic", "type": "effect", "effect": "ricochet", "effectValue": 1, "stackable": True, "maxStacks": 2, "cost": 20, "dependentOn": ["bullet_pierce_1"], "dependencyCount": 1, "incompatibleWith": ["homing_bullets"]},

    # VARIANT UPGRADES
    "homing_bullets": {"id": "homing_bullets", "name": "Homing Bullets", "description": "Bullets track nearest enemy with 60% reduced damage.", "rarity": "epic", "type": "variant", "target": "bullet", "attackType": "bullet", "variantClass": "HomingBullet", "replaces": "explosive_bullets", "stackable": False, "cost": 20},
    "explosive_bullets": {"id": "explosive_bullets", "name": "Explosive Bullets", "description": "Bullets explode on impact dealing collision and area damage.", "rarity": "epic", "type": "variant", "target": "bullet", "attackType": "bullet", "variantClass": "ExplosiveBullet", "replaces": "homing_bullets", "stackable": False, "cost": 20},

    # VISUAL EFFECT UPGRADES
    "player_glow": {"id": "player_glow", "name": "Radiant Core", "description": "Player emits a glowing aura", "rarity": "uncommon", "type": "visual_effect", "target": "player", "effect": "glow", "color": 65535, "intensity": 0.5, "stackable": False, "cost": 0},
    "projectile_trail": {"id": "projectile_trail", "name": "Particle Trail", "description": "Projectiles leave trails", "rarity": "common", "type": "visual_effect", "target": "bullet", "effect": "trail", "stackable": False, "cost": 0},

    # ABILITY UPGRADES
    "dash_ability": {"id": "dash_ability", "name": "Dash", "description": "Press SPACE to dash", "rarity": "rare", "type": "ability", "effect": "dash", "stackable": False, "cost": 10},
    "shield_ability": {"id": "shield_ability", "name": "Energy Shield", "description": "Press E for temporary shield (consumable, stacks)", "rarity": "rare", "type": "effect", "effect": "shield", "value": 1, "stackable": True, "maxStacks": 5, "cost": 10},

    # DASH CHARGE UPGRADES
    "double_dash": {"id": "double_dash", "name": "Double Dash", "description": "Store 2 dashes.", "rarity": "epic", "type": "ability", "effect": "double_dash", "stackable": False, "cost": 20, "dependentOn": ["dash_ability"], "dependencyCount": 1},
    "triple_dash": {"id": "triple_dash", "name": "Triple Dash", "description": "Store 3 dashes.", "rarity": "legendary", "type": "ability", "effect": "triple_dash", "stackable": False, "cost": 40, "dependentOn": ["double_dash"], "dependencyCount": 1},

    # CURSE UPGRADES
    "damage_reduc_1": {"id": "damage_reduc_1", "name": "Weakness 1", "description": "-0.1% damage.", "rarity": "common", "type": "stat_modifier", "target": "attack", "stat": "damage", "value": -0.001, "isMultiplier": True, "stackable": True, "maxStacks": 99999, "cost": 0, "curse": True},
    "damage_reduc_2": {"id": "damage_reduc_2", "name": "Weakness 2", "description": "-0.4% damage.", "rarity": "uncommon", "type": "stat_modifier", "target": "attack", "stat": "damage", "value": -0.004, "isMultiplier": True, "stackable": True, "maxStacks": 99999, "cost": 0, "curse": True},
    "damage_reduc_3": {"id": "damage_reduc_3", "name": "Weakness 3", "description": "-0.8% damage.", "rarity": "rare", "type": "stat_modifier", "target": "attack", "stat": "damage", "value": -0.008, "isMultiplier": True, "stackable": True, "maxStacks": 99999, "cost": 0, "curse": True},
    "damage_reduc_4": {"id": "damage_reduc_4", "name": "Weakness 4", "description": "-1.75% damage.", "rarity": "epic", "type": "stat_modifier", "target": "attack", "stat": "damage", "value": -0.0175, "isMultiplier": True, "stackable": True, "maxStacks": 99999, "cost": 0, "curse": True},
    "damage_reduc_5": {"id": "damage_reduc_5", "name": "Weakness 5", "description": "-3.75% damage.", "rarity": "legendary", "type": "stat_modifier", "target": "attack", "stat": "damage", "value": -0.0375, "isMultiplier": True, "stackable": True, "maxStacks": 99999, "cost": 0, "curse": True},
    "shattered_bullet_1": {"id": "shattered_bullet_1", "name": "Shattered Bullet 1", "description": "-1 bullet damage.", "rarity": "uncommon", "type": "stat_modifier", "target": "bullet", "stat": "damage", "value": -1, "isMultiplier": False, "stackable": True, "maxStacks": 99999, "cost": 0, "curse": True},
    "shattered_bullet_2": {"id": "shattered_bullet_2", "name": "Shattered Bullet 2", "description": "-3 bullet damage.", "rarity": "rare", "type": "stat_modifier", "target": "bullet", "stat": "damage", "value": -3, "isMultiplier": False, "stackable": True, "maxStacks": 99999, "cost": 0, "curse": True},
    "shattered_bullet_3": {"id": "shattered_bullet_3", "name": "Shattered Bullet 3", "description": "-5 bullet damage.", "rarity": "epic", "type": "stat_modifier", "target": "bullet", "stat": "damage", "value": -5, "isMultiplier": False, "stackable": True, "maxStacks": 99999, "cost": 0, "curse": True},
    "health_reduc_1": {"id": "health_reduc_1", "name": "Reduced Health 1", "description": "-5 max health.", "rarity": "common", "type": "stat_modifier", "target": "player", "stat": "maxHealth", "value": -5, "isMultiplier": False, "stackable": True, "maxStacks": 99999, "cost": 0, "curse": True},
    "health_reduc_2": {"id": "health_reduc_2", "name": "Reduced Health 2", "description": "-10 max health.", "rarity": "uncommon", "type": "stat_modifier", "target": "player", "stat": "maxHealth", "value": -10, "isMultiplier": False, "stackable": True, "maxStacks": 99999, "cost": 0, "curse": True},
    "health_reduc_3": {"id": "health_reduc_3", "name": "Reduced Health 3", "description": "-20 max health.", "rarity": "rare", "type": "stat_modifier", "target": "player", "stat": "maxHealth", "value": -20, "isMultiplier": False, "stackable": True, "maxStacks": 99999, "cost": 0, "curse": True},
    "health_reduc_4": {"id": "health_reduc_4", "name": "Reduced Health 4", "description": "-40 max health.", "rarity": "epic", "type": "stat_modifier", "target": "player", "stat": "maxHealth", "value": -40, "isMultiplier": False, "stackable": True, "maxStacks": 99999, "cost": 0, "curse": True},
    "health_reduc_5": {"id": "health_reduc_5", "name": "Reduced Health 5", "description": "-80 max health.", "rarity": "legendary", "type": "stat_modifier", "target": "player", "stat": "maxHealth", "value": -80, "isMultiplier": False, "stackable": True, "maxStacks": 99999, "cost": 0, "curse": True},
    "fragility_1": {"id": "fragility_1", "name": "Fragility 1", "description": "Increased damage taken by 1.25%", "rarity": "rare", "type": "effect", "effect": "protection", "effectValue": 0.0125, "isMultiplier": True, "stackable": True, "maxStacks": 3, "cost": 0, "curse": True},
    "fragility_2": {"id": "fragility_2", "name": "Fragility 2", "description": "Increased damage taken by 3.5%", "rarity": "epic", "type": "effect", "effect": "protection", "effectValue": 0.035, "isMultiplier": True, "stackable": True, "maxStacks": 1, "cost": 0, "curse": True},
}


def get_upgrade(upgrade_id: str) -> Dict[str, Any] | None:
    """Get upgrade definition by ID"""
    return UPGRADES.get(upgrade_id)


def get_upgrades_by_rarity(rarity: str) -> List[Dict[str, Any]]:
    """Get all upgrades of a specific rarity"""
    return [u for u in UPGRADES.values() if u["rarity"] == rarity]


def can_apply_upgrade(
    upgrade_id: str,
    current_upgrades: List[str],
    attack_type: str = "bullet"
) -> bool:
    """
    Check if an upgrade can be applied given current upgrades.

    Args:
        upgrade_id: ID of upgrade to check
        current_upgrades: List of currently applied upgrade IDs
        attack_type: Current player attack type

    Returns:
        True if upgrade can be applied
    """
    upgrade = get_upgrade(upgrade_id)
    if not upgrade:
        return False

    # Check attack type filter
    if upgrade.get("attackType") and upgrade.get("attackType") != attack_type:
        return False

    # Check if non-stackable and already applied
    if not upgrade.get("stackable", False):
        if upgrade_id in current_upgrades:
            return False

    # Check stack limit
    if upgrade.get("stackable") and upgrade.get("maxStacks"):
        current_stacks = current_upgrades.count(upgrade_id)
        if current_stacks >= upgrade["maxStacks"]:
            return False

    # Check dependencies
    if upgrade.get("dependentOn"):
        required = upgrade.get("dependencyCount", 1)
        dependency_count = sum(
            1 for dep_id in upgrade["dependentOn"]
            if dep_id in current_upgrades
        )
        if dependency_count < required:
            return False

    # Check for conflicts (replaces)
    if upgrade.get("replaces"):
        # Handle both string and list formats
        replaces = upgrade["replaces"]
        if isinstance(replaces, str):
            # Single string
            if replaces in current_upgrades:
                return False
        else:
            # List of strings
            for replaced_id in replaces:
                if replaced_id in current_upgrades:
                    return False

    # Check for incompatibilities
    if upgrade.get("incompatibleWith"):
        for incompatible_id in upgrade["incompatibleWith"]:
            if incompatible_id in current_upgrades:
                return False

    return True


def validate_upgrade_list(upgrade_ids: List[str]) -> bool:
    """Validate that all upgrades in a list are valid"""
    return all(get_upgrade(uid) is not None for uid in upgrade_ids)
