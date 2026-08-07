#!/usr/bin/env python3
"""
Computes a player's fully-resolved damage stats from a manual save file.

Replays purchaseHistory in order against the same rules the game itself uses
at runtime:
  - frontend/src/game/systems/upgrades/UpgradeModifierSystem.ts
    additive/multiplicative accumulation: result = (base + additive) * (1 + multiplicative)
    Curse stat_modifiers (shattered_bullet_*) can't push an additive total
    below 0 - once at/under 1 a further curse is a no-op, otherwise it clamps
    to 1 (see UpgradeModifierSystemClass.addModifier).
  - A handful of upgrades override onApply() to skip the generic modifier
    channel and instead mutate a value directly wherever it's used
    (frontend/src/game/upgrades/stat_modifiers/*.ts). Those are order-
    sensitive (explosion_damage_* is `+=`, explosion_damage_percent_* is
    `*= (1+value)`, applied as a single sequential chain - NOT grouped into
    the generic (base+add)*(1+mult) formula) and are replayed as such below.

Base stats (bullet/pellet/explosion/homing) are the SetDefaults() literals
from frontend/src/game/entities/projectiles/player_projectiles/Bullet.ts -
they aren't in upgrades.json (that file only holds upgrade deltas), so they
are hardcoded here; update them if those literals change.

Explosive Bullets deal two independent kinds of damage on hit: the bullet's
own direct-hit damage (scales with bullet_damage_*, same as a normal Bullet)
and a BulletExplosion AOE spawned afterwards (scales only with
explosion_damage_*/explosion_damage_percent_* and the universal damage_*
multiplier - explicitly NOT bullet_damage_*, per the comment in
BulletExplosion.SetDefaults()). Chain Reaction (explosion_on_kill) spawns the
same BulletExplosion class, so "explosion damage" is one shared number
regardless of which of the two triggered it.

Usage: python3 scripts/damage_report.py [path/to/save.txt]
"""
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
UPGRADES_JSON = REPO_ROOT / "backend/app/core/data/upgrades.json"
DEFAULT_SAVE = REPO_ROOT / "manual_saves/save2.txt"

# frontend/src/game/entities/projectiles/player_projectiles/Bullet.ts SetDefaults()
BASE_BULLET_DAMAGE = 10          # Bullet
BASE_BUCKSHOT_DAMAGE = 10        # BuckshotBullet (resolved like a normal bullet, then split below)
BUCKSHOT_PELLET_DAMAGE_FRACTION = 0.3  # BuckshotBullet.OnSpawn(): pellet.damage = this.damage * 0.3
BASE_HOMING_DAMAGE = 10          # HomingBullet
BASE_EXPLOSIVE_BULLET_CONTACT_DAMAGE = 10  # ExplosiveBullet (direct-hit damage, resolved like a normal bullet)
BASE_EXPLOSION_DAMAGE = 10       # BulletExplosion default base AND explosion_on_kill's effectValue
BASE_MIN_HOMING_MULTIPLIER = 0.4       # HomingBullet.minimumDamageMultiplier
BASE_MAX_HOMING_MULTIPLIER = 1.0       # HomingBullet.maximumSpawnDamageMultiplier (no upgrade currently raises this)

# Upgrades that override onApply() to skip the generic modifier channel and
# mutate a value by hand instead - see each file under
# frontend/src/game/upgrades/stat_modifiers/*.ts for the specific hook.
EXPLOSION_FLAT_IDS = {"explosion_damage_1", "explosion_damage_2", "explosion_damage_3"}
EXPLOSION_PERCENT_IDS = {"explosion_damage_percent_1", "explosion_damage_percent_2"}
MIN_HOMING_MULT_IDS = {"minimum_homing_damage_multiplier_1", "minimum_homing_damage_multiplier_2"}
# Also hook-driven but irrelevant to the damage numbers below (pellet count,
# spread, tracking distance) - listed so it's clear they're deliberately
# excluded from the generic modifier accumulation, not forgotten.
NON_GENERIC_IDS = EXPLOSION_FLAT_IDS | EXPLOSION_PERCENT_IDS | MIN_HOMING_MULT_IDS | {
    "denser_shells", "bullet_choke", "homing_distance_1", "homing_distance_2",
}


class ModifierSystem:
    """Mirrors UpgradeModifierSystem.ts."""

    def __init__(self):
        self.additive = {}
        self.multiplicative = {}

    def add(self, target, stat, value, is_multiplier, curse):
        table = self.multiplicative if is_multiplier else self.additive
        table.setdefault(target, {})
        current = table[target].get(stat, 0)

        if is_multiplier:
            table[target][stat] = current + value
            return

        if curse and current + value < 0:
            if current <= 1:
                return  # already floored, curse does nothing further
            table[target][stat] = 1
            return

        table[target][stat] = current + value

    def apply(self, target, stat, base_value):
        additive = self.additive.get(target, {}).get(stat, 0)
        multiplicative = self.multiplicative.get(target, {}).get(stat, 0)
        return (base_value + additive) * (1 + multiplicative)


def load_purchase_counts_in_order(save_path):
    with open(save_path) as f:
        save = json.load(f)
    return [entry["upgradeId"] for entry in save["upgrades"]["purchaseHistory"]]


def main():
    save_path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_SAVE
    upgrades = json.loads(UPGRADES_JSON.read_text())
    purchases = load_purchase_counts_in_order(save_path)

    mods = ModifierSystem()
    explosion_ops = []  # ("flat"|"percent", value), in purchase order
    min_homing_mult_bonus = 0.0
    owned = set()

    unknown_ids = []
    for upgrade_id in purchases:
        owned.add(upgrade_id)
        upgrade = upgrades.get(upgrade_id)
        if upgrade is None:
            unknown_ids.append(upgrade_id)
            continue

        if upgrade_id in EXPLOSION_FLAT_IDS:
            explosion_ops.append(("flat", upgrade["value"]))
        elif upgrade_id in EXPLOSION_PERCENT_IDS:
            explosion_ops.append(("percent", upgrade["value"]))
        elif upgrade_id in MIN_HOMING_MULT_IDS:
            min_homing_mult_bonus += upgrade["value"]
        elif upgrade_id in NON_GENERIC_IDS:
            continue  # pellet count / choke / tracking distance - not a damage stat
        elif upgrade.get("type") == "stat_modifier":
            mods.add(
                upgrade["target"],
                upgrade["stat"],
                upgrade["value"],
                upgrade.get("isMultiplier", False),
                upgrade.get("curse", False),
            )
        # "variant" / "effect" / "ability" types just get recorded in `owned`

    def resolve_bullet_damage(base):
        return mods.apply("attack", "damage", mods.apply("bullet", "damage", base))

    def resolve_explosion_damage(base):
        value = base
        for kind, v in explosion_ops:
            value = value + v if kind == "flat" else value * (1 + v)
        return mods.apply("attack", "damage", value)

    total_base_damage = resolve_bullet_damage(BASE_BULLET_DAMAGE)
    buckshot_pellet_damage = resolve_bullet_damage(BASE_BUCKSHOT_DAMAGE) * BUCKSHOT_PELLET_DAMAGE_FRACTION
    explosion_damage = resolve_explosion_damage(BASE_EXPLOSION_DAMAGE)
    explosive_bullet_contact_damage = resolve_bullet_damage(BASE_EXPLOSIVE_BULLET_CONTACT_DAMAGE)
    explosive_bullet_total_damage = explosive_bullet_contact_damage + explosion_damage
    homing_base = resolve_bullet_damage(BASE_HOMING_DAMAGE)
    max_homing_damage = homing_base * BASE_MAX_HOMING_MULTIPLIER
    min_homing_damage = homing_base * (BASE_MIN_HOMING_MULTIPLIER + min_homing_mult_bonus)

    print(f"Save: {save_path}")
    print(f"Purchases replayed: {len(purchases)}")
    if unknown_ids:
        print(f"WARNING: {len(unknown_ids)} purchased id(s) not found in upgrades.json: {sorted(set(unknown_ids))}")
    print()
    print("---BULLET---")
    print(f"Total base damage (Bullet):                         {total_base_damage:.4f}")
    print()

    print("---BUCKSHOT BULLET---")
    print(f"Total damage per buckshot pellet:                   {buckshot_pellet_damage:.4f}"
          + ("" if "buckshot_bullets" in owned else "  (buckshot_bullets not owned - never fires)"))
    print(f"Minium damage per buckshot:                         {3 * buckshot_pellet_damage:.4f}"
              + ("" if "buckshot_bullets" in owned else "  (buckshot_bullets not owned - never fires)"))
    print(f"Maximum damage per buckshot:                        {8 * buckshot_pellet_damage:.4f}"
                  + ("" if "buckshot_bullets" in owned else "  (buckshot_bullets not owned - never fires)"))
    print()

    print("---EXPLOSIVE BULLET")
    print(f"Explosion damage (on-kill or bullet AOE):           {explosion_damage:.4f}"
          + ("" if ("explosion_on_kill" in owned or "explosive_bullets" in owned)
             else "  (neither explosion_on_kill nor explosive_bullets owned - never triggers)"))
    print(f"Explosive bullet contact damage:                    {explosive_bullet_contact_damage:.4f}"
          + ("" if "explosive_bullets" in owned else "  (explosive_bullets not owned - never fires)"))
    print(f"Explosive bullet total damage (contact+explosion):  {explosive_bullet_total_damage:.4f}"
          + ("" if "explosive_bullets" in owned else "  (explosive_bullets not owned - never fires)"))
    print()

    print("---HOMING BULLET---")
    print(f"Maximum homing bullet damage:                       {max_homing_damage:.4f}"
          + ("" if "homing_bullets" in owned else "  (homing_bullets not owned - never fires)"))
    print(f"Minimum homing bullet damage:                       {min_homing_damage:.4f}"
          + ("" if "homing_bullets" in owned else "  (homing_bullets not owned - never fires)"))
    print()


if __name__ == "__main__":
    main()
