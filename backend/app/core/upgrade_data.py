"""
Upgrade definitions for backend upgrade rolling and validation.
This matches the frontend upgrade JSON files.
"""

from typing import Dict, List, Any

# Rarity weights (matches frontend RARITY_WEIGHTS)
RARITY_WEIGHTS = {
    "common": 0.50,      # 50%
    "uncommon": 0.30,    # 30%
    "rare": 0.15,        # 15%
    "epic": 0.04,        # 4%
    "legendary": 0.01    # 1%
}

# All upgrades - complete database
UPGRADES: Dict[str, Dict[str, Any]] = {
    # STAT UPGRADES
    "damage_1": {"id": "damage_1", "name": "Devastation", "description": "+0.1% damage.", "rarity": "common", "type": "stat_modifier", "target": "attack", "stat": "damage", "value": 0.001, "isMultiplier": True, "stackable": True, "maxStacks": 99999, "cost": 2},
    "damage_2": {"id": "damage_2", "name": "Devastation", "description": "+0.4% damage.", "rarity": "uncommon", "type": "stat_modifier", "target": "attack", "stat": "damage", "value": 0.004, "isMultiplier": True, "stackable": True, "maxStacks": 99999, "cost": 6},
    "damage_3": {"id": "damage_3", "name": "Devastation", "description": "+0.8% damage.", "rarity": "rare", "type": "stat_modifier", "target": "attack", "stat": "damage", "value": 0.008, "isMultiplier": True, "stackable": True, "maxStacks": 99999, "cost": 10},
    "damage_4": {"id": "damage_4", "name": "Devastation", "description": "+1.6% damage.", "rarity": "epic", "type": "stat_modifier", "target": "attack", "stat": "damage", "value": 0.016, "isMultiplier": True, "stackable": True, "maxStacks": 99999, "cost": 20},
    "damage_5": {"id": "damage_5", "name": "Devastation", "description": "+3.5% damage.", "rarity": "legendary", "type": "stat_modifier", "target": "attack", "stat": "damage", "value": 0.035, "isMultiplier": True, "stackable": True, "maxStacks": 99999, "cost": 40},

    "bullet_damage_1": {"id": "bullet_damage_1", "name": "Sharper Rounds", "description": "+1 bullet damage", "rarity": "common", "type": "stat_modifier", "target": "attack", "attackType": "bullet", "stat": "damage", "value": 1, "isMultiplier": False, "stackable": True, "maxStacks": 99999, "cost": 2},
    "bullet_damage_2": {"id": "bullet_damage_2", "name": "Shaper Rounds", "description": "+4 bullet damage", "rarity": "uncommon", "type": "stat_modifier", "target": "attack", "attackType": "bullet", "stat": "damage", "value": 4, "isMultiplier": False, "stackable": True, "maxStacks": 99999, "cost": 6},
    "bullet_damage_3": {"id": "bullet_damage_3", "name": "Shaper Rounds", "description": "+8 bullet damage", "rarity": "rare", "type": "stat_modifier", "target": "attack", "attackType": "bullet", "stat": "damage", "value": 8, "isMultiplier": False, "stackable": True, "maxStacks": 99999, "cost": 10},
    "bullet_damage_4": {"id": "bullet_damage_4", "name": "Shaper Rounds", "description": "+16 bullet damage", "rarity": "epic", "type": "stat_modifier", "target": "attack", "attackType": "bullet", "stat": "damage", "value": 16, "isMultiplier": False, "stackable": True, "maxStacks": 99999, "cost": 20},
    "bullet_damage_5": {"id": "bullet_damage_5", "name": "Shaper Rounds", "description": "+35 bullet damage", "rarity": "legendary", "type": "stat_modifier", "target": "attack", "attackType": "bullet", "stat": "damage", "value": 35, "isMultiplier": False, "stackable": True, "maxStacks": 99999, "cost": 40},

    "bullet_speed_1": {"id": "bullet_speed_1", "name": "Velocity Boost", "description": "+5% bullet speed", "rarity": "common", "type": "stat_modifier", "target": "bullet", "attackType": "bullet", "stat": "speed", "value": 0.05, "isMultiplier": True, "stackable": True, "maxStacks": 5, "cost": 2},
    "bullet_speed_2": {"id": "bullet_speed_2", "name": "Velocity Boost", "description": "+17% bullet speed", "rarity": "uncommon", "type": "stat_modifier", "target": "bullet", "attackType": "bullet", "stat": "speed", "value": 0.17, "isMultiplier": True, "stackable": True, "maxStacks": 5, "cost": 6},

    "bullet_pierce_1": {"id": "bullet_pierce_1", "name": "Piercing Shot", "description": "Bullets pierce +1 enemy", "rarity": "rare", "type": "stat_modifier", "target": "bullet", "attackType": "bullet", "stat": "pierce", "value": 1, "stackable": True, "maxStacks": 3, "cost": 10},

    "bullet_size_1": {"id": "bullet_size_1", "name": "Heavy Rounds", "description": "+10% bullet size", "rarity": "uncommon", "type": "stat_modifier", "target": "bullet", "attackType": "bullet", "stat": "size", "value": 0.10, "isMultiplier": True, "stackable": True, "maxStacks": 3, "cost": 6},
    "bullet_size_2": {"id": "bullet_size_2", "name": "Heavy Rounds", "description": "+25% bullet size", "rarity": "rare", "type": "stat_modifier", "target": "bullet", "attackType": "bullet", "stat": "size", "value": 0.25, "isMultiplier": True, "stackable": True, "maxStacks": 2, "cost": 10},

    "laser_damage_1": {"id": "laser_damage_1", "name": "Focused Beam", "description": "+15 laser damage", "rarity": "uncommon", "type": "stat_modifier", "target": "laser", "attackType": "laser", "stat": "damage", "value": 15, "stackable": True, "maxStacks": 99, "cost": 40},
    "laser_pierce_1": {"id": "laser_pierce_1", "name": "Penetrating Beam", "description": "Laser pierces +1 enemy", "rarity": "rare", "type": "stat_modifier", "target": "laser", "attackType": "laser", "stat": "pierce", "value": 1, "stackable": True, "maxStacks": 10, "cost": 100},

    "player_health_1": {"id": "player_health_1", "name": "Reinforced Core", "description": "+10 max health", "rarity": "common", "type": "stat_modifier", "target": "player", "stat": "maxHealth", "value": 10, "stackable": True, "maxStacks": 20, "cost": 2},
    "player_health_2": {"id": "player_health_2", "name": "Reinforced Core", "description": "+30 max health", "rarity": "uncommon", "type": "stat_modifier", "target": "player", "stat": "maxHealth", "value": 30, "stackable": True, "maxStacks": 15, "cost": 6},
    "player_health_3": {"id": "player_health_3", "name": "Reinforced Core", "description": "+60 max health", "rarity": "rare", "type": "stat_modifier", "target": "player", "stat": "maxHealth", "value": 60, "stackable": True, "maxStacks": 10, "cost": 10},
    "player_health_4": {"id": "player_health_4", "name": "Reinforced Core", "description": "+130 max health", "rarity": "epic", "type": "stat_modifier", "target": "player", "stat": "maxHealth", "value": 130, "stackable": True, "maxStacks": 8, "cost": 20},
    "player_health_5": {"id": "player_health_5", "name": "Reinforced Core", "description": "+300 max health", "rarity": "legendary", "type": "stat_modifier", "target": "player", "stat": "maxHealth", "value": 300, "stackable": True, "maxStacks": 5, "cost": 40},

    "knockback_1": {"id": "knockback_1", "name": "Knockback Boost", "description": "+5% knockback", "rarity": "common", "type": "stat_modifier", "target": "attack", "stat": "knockback", "value": 0.05, "isMultiplier": True, "stackable": True, "maxStacks": 5, "cost": 2},
    "knockback_2": {"id": "knockback_2", "name": "Knockback Boost", "description": "+20% knockback", "rarity": "uncommon", "type": "stat_modifier", "target": "attack", "stat": "knockback", "value": 0.20, "isMultiplier": True, "stackable": True, "maxStacks": 5, "cost": 6},
    "knockback_3": {"id": "knockback_3", "name": "Knockback Boost", "description": "+50% knockback", "rarity": "rare", "type": "stat_modifier", "target": "attack", "stat": "knockback", "value": 0.50, "isMultiplier": True, "stackable": True, "maxStacks": 5, "cost": 10},

    "player_speed_1": {"id": "player_speed_1", "name": "Thruster Boost", "description": "+10 movement speed", "rarity": "uncommon", "type": "stat_modifier", "target": "player", "stat": "speed", "value": 10, "stackable": True, "maxStacks": 10, "cost": 6},

    "polygon_upgrade": {"id": "polygon_upgrade", "name": "Evolution", "description": "+1 polygon side", "rarity": "legendary", "type": "stat_modifier", "target": "player", "stat": "polygonSides", "value": 1, "stackable": True, "maxStacks": 9, "cost": 35},

    "explosion_radius": {"id": "explosion_radius", "name": "Blast Radius", "description": "+5 explosion radius", "rarity": "uncommon", "type": "stat_modifier", "target": "bullet", "attackType": "bullet", "stat": "explosionRadius", "value": 5, "stackable": True, "maxStacks": 5, "cost": 6, "dependentOn": ["explosive_bullets"], "dependencyCount": 1},

    # EFFECT UPGRADES
    "vampirism_1": {"id": "vampirism_1", "name": "Vampirism", "description": "Heal for 2% of damage dealt", "rarity": "rare", "type": "effect", "effect": "lifesteal", "effectValue": 0.02, "stackable": False, "maxStacks": 1, "cost": 10, "tier": 1, "upgradesTo": "vampirism_2"},
    "vampirism_2": {"id": "vampirism_2", "name": "Vampirism", "description": "Heal for 5% of damage dealt", "rarity": "epic", "type": "effect", "effect": "lifesteal", "effectValue": 0.05, "stackable": False, "maxStacks": 1, "cost": 20, "tier": 2, "upgradesTo": "vampirism_3"},
    "vampirism_3": {"id": "vampirism_3", "name": "Vampirism", "description": "Heal for 12% of damage dealt", "rarity": "legendary", "type": "effect", "effect": "lifesteal", "effectValue": 0.12, "stackable": False, "maxStacks": 1, "cost": 40, "tier": 3},

    "regeneration": {"id": "regeneration", "name": "Auto Repair", "description": "Regenerate 1 HP/sec", "rarity": "epic", "type": "effect", "effect": "regen", "effectValue": 1, "stackable": True, "maxStacks": 3, "cost": 20},

    "armor": {"id": "armor", "name": "Hardened Shell", "description": "Reduce incoming damage by 2.5%", "rarity": "rare", "type": "effect", "effect": "armor", "effectValue": 0.025, "multipler": True, "stackable": True, "maxStacks": 5, "cost": 10},
    "armor_2": {"id": "armor_2", "name": "Hardened Shell", "description": "Reduce incoming damage by 6%", "rarity": "epic", "type": "effect", "effect": "armor", "effectValue": 0.06, "multipler": True, "stackable": True, "maxStacks": 5, "cost": 20},

    "thorns": {"id": "thorns", "name": "Thorns", "description": "Reflect 10% of damage taken", "rarity": "epic", "type": "effect", "effect": "thorns", "effectValue": 0.1, "stackable": True, "maxStacks": 3, "cost": 20},

    "explosion_on_kill": {"id": "explosion_on_kill", "name": "Chain Reaction", "description": "Enemies explode on death", "rarity": "epic", "type": "effect", "effect": "explode_on_kill", "effectValue": 20, "stackable": False, "cost": 20},

    "multishot_1": {"id": "multishot_1", "name": "Double Tap", "description": "Fire +1 additional projectile", "rarity": "legendary", "type": "effect", "effect": "multishot", "attackType": "bullet", "effectValue": 1, "stackable": True, "maxStacks": 2, "cost": 40},

    "ricochet": {"id": "ricochet", "name": "Ricochet Rounds", "description": "Projectiles bounce off surfaces.", "rarity": "epic", "type": "effect", "effect": "ricochet", "effectValue": 1, "stackable": True, "maxStacks": 2, "cost": 20, "dependentOn": ["bullet_pierce_1"], "dependencyCount": 1},

    # VARIANT UPGRADES
    "homing_bullets": {"id": "homing_bullets", "name": "Homing Bullets", "description": "Bullets track nearest enemy with reduced damage.", "rarity": "epic", "type": "variant", "target": "bullet", "attackType": "bullet", "variantClass": "HomingBullet", "replaces": ["explosive_bullets"], "stackable": False, "cost": 20},
    "explosive_bullets": {"id": "explosive_bullets", "name": "Explosive Bullets", "description": "Bullets explode on impact", "rarity": "epic", "type": "variant", "target": "bullet", "attackType": "bullet", "variantClass": "ExplosiveBullet", "replaces": ["homing_bullets"], "stackable": False, "cost": 20},

    # VISUAL EFFECT UPGRADES
    "player_glow": {"id": "player_glow", "name": "Radiant Core", "description": "Player emits a glowing aura", "rarity": "uncommon", "type": "visual_effect", "target": "player", "effect": "glow", "color": 65535, "intensity": 0.5, "stackable": False, "cost": 0},
    "projectile_trail": {"id": "projectile_trail", "name": "Particle Trail", "description": "Projectiles leave trails", "rarity": "common", "type": "visual_effect", "target": "bullet", "effect": "trail", "stackable": False, "cost": 0},

    # ABILITY UPGRADES
    "dash_ability": {"id": "dash_ability", "name": "Dash", "description": "Press SPACE to dash", "rarity": "rare", "type": "ability", "effect": "dash", "stackable": False, "cost": 10},
    "shield_ability": {"id": "shield_ability", "name": "Energy Shield", "description": "Press E for temporary shield", "rarity": "rare", "type": "ability", "effect": "shield", "stackable": False, "cost": 10},
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
        for replaced_id in upgrade["replaces"]:
            if replaced_id in current_upgrades:
                return False

    return True


def validate_upgrade_list(upgrade_ids: List[str]) -> bool:
    """Validate that all upgrades in a list are valid"""
    return all(get_upgrade(uid) is not None for uid in upgrade_ids)
