#!/usr/bin/env python3
"""
Monte-Carlo run simulator: plays out the shop/bundle/milestone economy wave by
wave and reports how player damage output scales against the enemy health
curve - "is explosive_bullets outrunning the difficulty curve, and by how much
relative to buckshot", without playing hundreds of real runs.

Nothing about combat is simulated. Enemies are assumed to be 100% cleared every
wave; what's modeled is everything that decides how strong the player GETS:
points income, shop rolls and purchases, rerolls, bundle drops and their curse
rolls, and the free evolution milestone.

Reads the live game tables (app.core.*) and reuses WaveService's own pure
methods for offer rolling and damage math, so the sim can't drift from the
server. No database writes; Mongo is only read for --policy pickrate.

Usage (from backend/):
  venv/bin/python scripts/simulate_run.py --wave 30
  venv/bin/python scripts/simulate_run.py --wave 30 --runs 1000
  venv/bin/python scripts/simulate_run.py --wave 30 --variant explosive --detail
  venv/bin/python scripts/simulate_run.py --wave 30 --force-variant-wave 15
  venv/bin/python scripts/simulate_run.py --wave 30 --policy pickrate --csv sim.csv

FLAGS

--wave N                (default 30)
    Last wave to simulate. Every run plays waves 1..N; there's no death model,
    so a run never ends early. Costs scale linearly, so --wave 30 is 3x the
    work of --wave 10.

--runs N                (default 500)
    Runs per cohort. This is the sample size that averages out bundle luck and
    roll order WITHIN a cohort - it does not blend variants together (see
    COHORTS below). ~50 is enough to eyeball a trend, 500+ before trusting a
    gap of less than ~15% between two cohorts. Total work is --runs x cohorts,
    so the default with --variant all is 2500 runs.

--variant all|natural|none|explosive|buckshot|homing     (default all)
    Which cohort(s) to run.
      all        every cohort below, side by side - the default, and the only
                 mode that answers "which variant is overtuned"
      natural    policy picks whatever it's offered (what really happens)
      none       refuses every bullet variant - the control/baseline
      explosive  \
      buckshot    > forces that variant and excludes the other two, including
      homing     /  out of bundle drops
    Naming a single cohort implies --detail.

--force-variant-wave N  (default: as soon as it's affordable, from wave 1)
    Wave from which a forced cohort's variant is injected into the shop offer
    until bought. Two reasons this exists: the shop almost never offers a
    specific epic on its own (~0.2% of a slot, so a forced cohort would mostly
    never get its variant), and pinning the wave holds acquisition constant so
    cohorts differ only by WHICH variant they got, not when. Use --wave 30
    --force-variant-wave 15 for the cleanest comparison: all cohorts are
    identical through wave 14 and diverge only after.

--policy greedy-damage|pickrate                          (default greedy-damage)
    How the simulated player decides what to buy.
      greedy-damage  buys whichever affordable slot most raises expected
                     discharge damage. Models a pure-damage build, which
                     stresses the damage-vs-enemy-health question hardest.
                     Note it never buys health/utility, so the EHP columns
                     move only on free bundle/milestone grants.
      pickrate       buys each slot with the probability real players did, from
                     the recorded runs (same source as analyze_runs.py
                     pick-rate). Needs Mongo and pymongo. Those per-(upgrade,
                     wave) cells are very sparse, so every rate is
                     Laplace-smoothed and falls back per-upgrade, then
                     per-rarity, then to a global default.

--difficulty ID         (default normal)
    Which Difficulty to pull enemy counts, spawn weights, rarity weights,
    bundle odds and scaling curves from. Only "normal" exists today.

--seed N                (default 1234)
    Base RNG seed. Run #i of EVERY cohort uses seed+i, so all cohorts see the
    same shop and bundle luck and a gap between columns is the variant rather
    than the dice. Change it to confirm a finding isn't a seed artifact.

--detail
    Also print, per cohort, the full per-wave damage breakdown (every
    variant-specific field, sides, pierce, HP) and the 20 most-owned upgrades
    at run end. Implied when --variant names a single cohort. All-zero columns
    are hidden, so a non-buckshot cohort shows no pellet columns.

--csv PATH
    Also write every metric to PATH in long format:
    cohort,wave,metric,median,p25,p75,runs. This is the only output carrying
    the p25/p75 spread - the terminal tables print medians only.

COHORTS
Bullet variants are a design fork, not noise: averaging explosive and buckshot
together hides an overbuffed one cancelling an underbuffed one. So --variant all
(the default) runs each variant as its own forced cohort and reports them side
by side. Within a cohort, --runs is averaged normally - bundle luck and roll
order genuinely ARE noise. `natural` is the unforced cohort (the policy picks
whatever it's offered), which is what actually happens in a real run; the other
four hold the variant constant.

Pair --variant all with --force-variant-wave N for a true apples-to-apples
comparison - otherwise explosive-acquired-on-wave-5 vs buckshot-acquired-on-
wave-22 is most of what you'd be measuring. All cohorts share the same seed
sequence, so run #7 of every cohort sees the same shop/bundle luck.
"""

from __future__ import annotations

import argparse
import csv
import io
import os
import random
import statistics
import sys
from collections import Counter, defaultdict
from contextlib import redirect_stdout
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.difficulty import get_difficulty
from app.core.difficulty.base import Difficulty
from app.core.enemy_data import (
    HEXAGON_SHIELD_RATIO,
    calculate_expected_health_spawned,
    get_enemy_bundle_drop_chance,
    get_enemy_health,
    get_enemy_score_chance,
    get_split_children,
)
from app.core.projectile_data import (
    get_base_pierce,
    get_pellet_range,
    resolve_active_projectile,
)
from app.core.upgrade_data import STARTING_UPGRADES, UPGRADES, can_apply_upgrade, get_upgrade
from app.services.wave_service import WaveService

# WaveService's offer-rolling and damage methods are pure - they only touch
# module-level game tables and class constants, never self.db - so the sim
# borrows them off an uninitialized instance rather than reimplementing (and
# eventually mis-implementing) the damage pipeline. __new__ skips __init__
# precisely so no database is required.
SERVICE = WaveService.__new__(WaveService)

# Economy constants that live on the client rather than in a data file.
STARTING_POINTS = 70          # WaveService.start_wave's new-game bonus
REROLL_COST = 1               # UpgradeModal.tsx's `useState(1)`
MILESTONE_EVERY = 6           # WaveManager: +1 polygon side every 6th wave
MILESTONE_UPGRADE = "polygon_upgrade"

# HomingBullet.ts SetDefaults() - no data file mirrors these yet.
HOMING_BASE_MAX_MULT = 1.0    # maximumSpawnDamageMultiplier
HOMING_BASE_MIN_MULT = 0.4    # minimumDamageMultiplier
HOMING_BASE_HIT_REDUCTION = 0.3  # hitEnemyDamageReduction (compounds per pierce)

BULLET_VARIANTS = {
    "explosive": "explosive_bullets",
    "buckshot": "buckshot_bullets",
    "homing": "homing_bullets",
}
# `natural` lets the policy choose; `none` refuses every variant; the rest force one.
COHORTS = ["natural", "none", "explosive", "buckshot", "homing"]

RARITY_ORDER = ["common", "uncommon", "rare", "epic", "legendary"]


def _quiet(fn, *args, **kwargs):
    """Run a WaveService method with its debug prints swallowed."""
    with redirect_stdout(io.StringIO()):
        return fn(*args, **kwargs)


# ---------------------------------------------------------------------------
# Damage model
# ---------------------------------------------------------------------------

def build_damage_profile(upgrades: List[str]) -> Dict[str, float]:
    """
    Every damage-output number the report shows, for one upgrade list.

    Per-hit damage comes straight from WaveService._calculate_max_damage_per_hit
    (the same function that writes player_projectile_damage into a real
    WaveSnapshot), so the sim's headline numbers are directly comparable to
    damage_scaling_ratio.py's output on real runs. The variant-specific fields
    below are kept SEPARATE from it rather than folded in - pierce and pellet
    count multiply throughput, not per-hit damage, and mixing them would make
    the two incomparable.
    """
    stats = _quiet(SERVICE._calculate_player_stats_from_upgrades, upgrades)
    sides = max(3, min(12, int(stats["polygon_sides"])))

    damage = SERVICE._calculate_max_damage_per_hit(upgrades)
    max_primary = damage["max_primary"]

    projectile = resolve_active_projectile("bullet", upgrades)
    flat_pierce, _ = SERVICE._sum_stat_modifiers(upgrades, "bullet", "pierce")
    pierce = max(1, int(get_base_pierce(projectile) + flat_pierce))

    # Explosions only exist if something can actually produce one; max_explosion
    # is a validation ceiling that's nonzero even for builds that can't explode
    # (same gate _record_wave_snapshot applies).
    explosion_active = "explosion_on_kill" in upgrades or "explosive_bullets" in upgrades
    explosion_damage = damage["max_explosion"] if explosion_active else 0.0

    profile = {
        "polygon_sides": float(sides),
        "pierce": float(pierce),
        "damage_per_projectile": max_primary,
        "damage_per_projectile_spawn_with_pierce": max_primary * pierce,
        "explosion_damage": explosion_damage,
        "buckshot_single_pellet_damage": 0.0,
        "buckshot_projectile_minimum_damage": 0.0,
        "buckshot_projectile_maximum_damage": 0.0,
        "homing_bullet_maximum_damage": 0.0,
        "homing_bullet_minimum_damage": 0.0,
    }

    if projectile == "buckshot_bullets":
        # max_primary already carries the 0.3 pellet fraction
        # (_calculate_max_damage_per_hit applies get_pellet_damage_fraction),
        # so it IS the per-pellet number. BuckshotBullet.OnSpawn fires
        # Between(minPellets, maxPellets) of them per vertex.
        base_min, base_max = get_pellet_range(projectile)
        min_flat, _ = SERVICE._sum_stat_modifiers(upgrades, "bullet", "minPellets")
        max_flat, _ = SERVICE._sum_stat_modifiers(upgrades, "bullet", "maxPellets")
        min_pellets = base_min + min_flat
        max_pellets = base_max + max_flat
        profile["buckshot_single_pellet_damage"] = max_primary
        profile["buckshot_projectile_minimum_damage"] = max_primary * min_pellets * pierce
        profile["buckshot_projectile_maximum_damage"] = max_primary * max_pellets * pierce

    if projectile == "homing_bullets":
        # Damage decays to minimumDamageMultiplier over the first half of the
        # bullet's life, and each pierce past the first compounds
        # (1 - hitEnemyDamageReduction) off the ORIGINAL damage
        # (HomingBullet.OnHitNPC). Max = a fresh bullet's first hit;
        # min = a fully-decayed bullet on its last pierce.
        min_mult_flat, _ = SERVICE._sum_stat_modifiers(upgrades, "bullet", "minimumDamageMultiplier")
        reduction_flat, _ = SERVICE._sum_stat_modifiers(upgrades, "bullet", "hitEnemyDamageReduction")
        min_mult = HOMING_BASE_MIN_MULT + min_mult_flat
        # stronger_pierce_* carry negative values, so this shrinks the penalty.
        # Clamped because crossing zero would flip (1 - x) above 1 and turn
        # pierce into damage amplification.
        reduction = max(0.0, HOMING_BASE_HIT_REDUCTION + reduction_flat)
        profile["homing_bullet_maximum_damage"] = max_primary * HOMING_BASE_MAX_MULT
        profile["homing_bullet_minimum_damage"] = (
            max_primary * min_mult * ((1 - reduction) ** (pierce - 1))
        )

    profile["expected_discharge_damage"] = _expected_discharge_damage(profile, projectile, sides, pierce)
    profile["total_discharge_damage"] = profile["damage_per_projectile"] * sides

    # Survivability side of the same question: enemy damage scales on the same
    # exp(wave/8) curve player max health does not.
    protection = 0.0
    for upgrade_id in upgrades:
        upgrade = UPGRADES.get(upgrade_id)
        if not upgrade or upgrade.get("effect") != "protection":
            continue
        # armor* store the magnitude in effectValue, fragility* (curses) in
        # value - same effect, two field names. A curse means damage TAKEN
        # goes up, so it subtracts from protection.
        magnitude = upgrade.get("effectValue", upgrade.get("value", 0)) or 0
        protection += -magnitude if upgrade.get("curse") else magnitude
    protection = min(0.95, protection)

    profile["max_health"] = stats["max_health"]
    profile["effective_ehp"] = stats["max_health"] / (1 - protection)
    return profile


def _expected_discharge_damage(
    profile: Dict[str, float], projectile: str, sides: int, pierce: int
) -> float:
    """
    One comparable scalar for "how much damage does a single Player.shoot()
    discharge put out", across variants that express their power very
    differently. Used both as the greedy policy's scoring function and as the
    report's headline scaling column.

    Scoring on per-hit damage alone would make the policy blind to buckshot
    (weak pellets, lots of them) and homing (full damage only on a fresh
    bullet's first hit), so each variant is reduced to its own expected value.
    """
    per_vertex: float
    if projectile == "buckshot_bullets":
        per_vertex = (
            profile["buckshot_projectile_minimum_damage"]
            + profile["buckshot_projectile_maximum_damage"]
        ) / 2
    elif projectile == "homing_bullets":
        per_vertex = (
            profile["homing_bullet_maximum_damage"]
            + profile["homing_bullet_minimum_damage"]
        ) / 2 * pierce
    else:
        per_vertex = profile["damage_per_projectile_spawn_with_pierce"]

    # An explosion fires per projectile that lands, so it scales with the
    # same vertex fanout as the primary hit.
    return (per_vertex + profile["explosion_damage"] * pierce) * sides


# ---------------------------------------------------------------------------
# Purchase policies
# ---------------------------------------------------------------------------

class Policy:
    """Decides what to buy off an offer and whether to reroll."""

    def __init__(self, forced_variant: Optional[str], allow_variants: bool):
        self.forced_variant = forced_variant
        self.allow_variants = allow_variants

    def rejects(self, upgrade_id: str) -> bool:
        """Variants the cohort isn't allowed to take."""
        if upgrade_id not in BULLET_VARIANTS.values():
            return False
        if not self.allow_variants:
            return True
        if self.forced_variant:
            return upgrade_id != self.forced_variant
        return False

    def choose(self, offer, upgrades, points, wave, rng):
        raise NotImplementedError

    def wants_reroll(self, points: int, bought_this_roll: int, rerolls_done: int) -> bool:
        raise NotImplementedError


class GreedyDamagePolicy(Policy):
    """
    Buys whichever affordable slot most increases expected_discharge_damage.

    Deliberately ignores health/speed/utility: this models a pure-damage build,
    which is the build that stresses the damage-vs-enemy-health question hardest.
    A consequence worth remembering when reading the report - the EHP columns
    under this policy move only on free bundle/milestone grants, never purchases.
    """

    def choose(self, offer, upgrades, points, wave, rng):
        baseline = build_damage_profile(upgrades)["expected_discharge_damage"]
        best, best_delta = None, 0.0
        for upgrade in offer:
            uid = upgrade["id"]
            if self.rejects(uid):
                continue
            cost = upgrade.get("cost", 0)
            if cost > points:
                continue
            if not can_apply_upgrade(uid, upgrades, "bullet"):
                continue
            # A forced variant is taken on sight - it's the controlled
            # variable, not something the policy gets an opinion about.
            if self.forced_variant and uid == self.forced_variant:
                return upgrade
            delta = build_damage_profile(upgrades + [uid])["expected_discharge_damage"] - baseline
            if delta > best_delta:
                best, best_delta = upgrade, delta
        return best

    def wants_reroll(self, points, bought_this_roll, rerolls_done):
        # Reroll only with points left over after buying nothing useful, and
        # only while there's enough left to actually act on a better roll.
        return bought_this_roll == 0 and points >= REROLL_COST + 2 and rerolls_done < 8


class PickRatePolicy(Policy):
    """
    Buys each affordable slot with the probability real players bought it,
    from analyze_runs.py's pick-rate data.

    Per-(upgrade, wave) cells are far too sparse to use raw (a few thousand
    offer slots spread over 84 upgrades x 30 waves), so every rate is
    Laplace-smoothed and falls back per-upgrade, then per-rarity, then to a
    global default.
    """

    PRIOR = 4.0  # pseudo-observations pulling a sparse cell toward its fallback

    def __init__(self, forced_variant, allow_variants, rates):
        super().__init__(forced_variant, allow_variants)
        self.by_wave, self.by_upgrade, self.by_rarity, self.overall = rates

    def _rate(self, uid: str, wave: int) -> float:
        rarity = (get_upgrade(uid) or {}).get("rarity", "common")
        fallback = self.by_upgrade.get(uid)
        if fallback is None:
            fallback = self.by_rarity.get(rarity, self.overall)
        picked, offered = self.by_wave.get((uid, wave), (0.0, 0.0))
        return (picked + self.PRIOR * fallback) / (offered + self.PRIOR)

    def choose(self, offer, upgrades, points, wave, rng):
        for upgrade in offer:
            uid = upgrade["id"]
            if self.rejects(uid):
                continue
            if upgrade.get("cost", 0) > points:
                continue
            if not can_apply_upgrade(uid, upgrades, "bullet"):
                continue
            if self.forced_variant and uid == self.forced_variant:
                return upgrade
            if rng.random() < self._rate(uid, wave):
                return upgrade
        return None

    def wants_reroll(self, points, bought_this_roll, rerolls_done):
        return bought_this_roll == 0 and points >= REROLL_COST + 2 and rerolls_done < 8


def load_pick_rates(difficulty_id: str) -> Tuple[dict, dict, dict, float]:
    """Pull pick-rate counts out of Mongo, at three levels of aggregation."""
    try:
        from pymongo import MongoClient
    except ImportError:
        sys.exit("--policy pickrate needs pymongo (it reads the recorded runs).")

    url = os.environ.get("MONGODB_URL", "mongodb://localhost:27017")
    database = os.environ.get("MONGODB_DATABASE", "polygon_game")
    db = MongoClient(url, serverSelectionTimeoutMS=5000)[database]

    by_wave: Dict[Tuple[str, int], List[float]] = defaultdict(lambda: [0.0, 0.0])
    by_upgrade: Dict[str, List[float]] = defaultdict(lambda: [0.0, 0.0])

    for run in db.game_runs.find({"difficulty_id": difficulty_id}, {"wave_snapshots": 1}):
        for snapshot in run.get("wave_snapshots", []):
            wave = snapshot.get("wave_number", 0)
            bought = Counter(snapshot.get("upgrades_purchased", []))
            for offer in snapshot.get("upgrade_offers", []):
                priced_out = list(offer.get("unaffordable", []))
                for uid in offer.get("upgrades", []):
                    if uid in priced_out:
                        priced_out.remove(uid)
                        continue  # couldn't afford it; not a preference signal
                    by_wave[(uid, wave)][1] += 1
                    by_upgrade[uid][1] += 1
            for uid, count in bought.items():
                by_wave[(uid, wave)][0] += count
                by_upgrade[uid][0] += count

    total_picked = sum(v[0] for v in by_upgrade.values())
    total_offered = sum(v[1] for v in by_upgrade.values())
    if not total_offered:
        sys.exit(f"No recorded offers for difficulty '{difficulty_id}' - use --policy greedy-damage.")
    overall = total_picked / total_offered

    by_rarity: Dict[str, List[float]] = defaultdict(lambda: [0.0, 0.0])
    for uid, (picked, offered) in by_upgrade.items():
        rarity = (get_upgrade(uid) or {}).get("rarity", "common")
        by_rarity[rarity][0] += picked
        by_rarity[rarity][1] += offered

    print(f"pick-rate source: {total_picked:.0f} buys / {total_offered:.0f} affordable "
          f"offer slots (overall {overall:.1%})")
    return (
        {k: tuple(v) for k, v in by_wave.items()},
        {k: (v[0] / v[1]) for k, v in by_upgrade.items() if v[1] > 0},
        {k: (v[0] / v[1]) for k, v in by_rarity.items() if v[1] > 0},
        overall,
    )


# ---------------------------------------------------------------------------
# Wave simulation
# ---------------------------------------------------------------------------

def sample_spawn_composition(wave: int, difficulty: Difficulty, rng: random.Random) -> Counter:
    """
    An actual integer roster for this wave: the wave's enemy count distributed
    multinomially over its spawn weights, plus scheduled boss spawns.

    Split children (Octogon's 2 squares) are deliberately NOT in this roster.
    EnemyManager.spawnEnemy('square', x, y, false, false) passes
    dropScore=false and dropBundle=false, so they roll neither score nor
    bundles - and the only other thing they contribute, health on the field,
    is already counted by calculate_expected_health_spawned. Including them
    here would double-count the health and invent income that doesn't exist.
    """
    counts: Counter = Counter()
    weights = difficulty.get_spawn_weights(wave)
    total_weight = sum(w["weight"] for w in weights) or 1.0
    population = [w["type"] for w in weights]
    probabilities = [w["weight"] / total_weight for w in weights]

    for _ in range(difficulty.get_enemy_count(wave)):
        counts[rng.choices(population, weights=probabilities, k=1)[0]] += 1
    for boss_type in (difficulty.get_scheduled_boss_spawns(wave) or []):
        counts[boss_type] += 1

    return counts


def roll_points(wave: int, roster: Counter, rng: random.Random) -> int:
    """
    Wave income: the server-computed completion bonus plus one score roll per
    killed enemy at its own score_chance. Split children are excluded by the
    caller (dropScore=false), so only the roster passes through here.
    """
    wave_bonus = min(55, 25 + wave * 2)
    drops = 0
    for enemy_type, count in roster.items():
        chance = get_enemy_score_chance(enemy_type)
        if chance > 0:
            drops += rng.binomialvariate(count, min(1.0, chance))
    return wave_bonus + drops


def roll_bundle_drops(wave: int, roster: Counter, difficulty: Difficulty,
                      rng: random.Random) -> List[Optional[int]]:
    """
    How many bundles this wave drops, and at what forced tier (None = roll the
    wave's own odds). Per-enemy drop chance with the wave-level rate as
    fallback, mirroring get_enemy_bundle_drop_chance - every regular enemy is
    currently 0.0 and so uses the wave rate, but a per-enemy value assigned
    later is picked up here for free.

    Dodecahedron additionally force-drops 1-2 legendary bundles client-side
    (Dodecahedron.DropBundles), independent of the wave's organic odds.
    """
    bundles: List[Optional[int]] = []
    for enemy_type, count in roster.items():
        chance = get_enemy_bundle_drop_chance(enemy_type, difficulty, wave)
        if chance > 0:
            bundles.extend([None] * rng.binomialvariate(count, min(1.0, chance)))
        if enemy_type == "dodecahedron":
            legendary = RARITY_ORDER.index("legendary")
            bundles.extend([legendary] * (count * rng.randint(1, 2)))
    return bundles


def _weighted_tier(weights: Dict[str, float], rng: random.Random) -> int:
    """Pick a rarity tier index from a rarity->weight map (mirrors _weighted_rarity_choice)."""
    roll = rng.random() * (sum(weights.values()) or 1.0)
    for tier, rarity in enumerate(RARITY_ORDER):
        roll -= weights.get(rarity, 0.0)
        if roll <= 0:
            return tier
    return 0


def roll_bundle_contents(wave: int, difficulty: Difficulty, upgrades: List[str],
                         forced_tier: Optional[int], policy: "Policy",
                         rng: random.Random) -> List[str]:
    """
    One bundle's worth of granted upgrades, mirroring
    WaveService.collect_upgrade_bundle: slot one is a non-curse upgrade at the
    bundle's own tier, then 1-4 items total at a re-rolled tier <= the
    bundle's, each with a 30% chance of being a curse instead. Free - bundles
    are the only way curses enter a run at all.

    The one deliberate deviation from the real game: a controlled cohort's
    rejected variants are filtered out of the pool. Bundles can and do drop
    bullet variants for free, which would otherwise hand the `buckshot` cohort
    a homing bullet and silently destroy the comparison. The `natural` cohort
    rejects nothing, so it keeps the real behavior.
    """
    weights = difficulty.get_bundle_rarity_weights(wave)
    max_tier = max((t for t, r in enumerate(RARITY_ORDER) if weights.get(r, 0) > 0), default=0)
    if "dodecahedron" in (difficulty.get_scheduled_boss_spawns(wave) or []):
        max_tier = max(max_tier, RARITY_ORDER.index("legendary"))

    if forced_tier is None:
        # The bundle's own tier is rolled at DROP time from the wave's bundle
        # weights (client-side), and collect_upgrade_bundle only clamps that
        # claim to what the wave can legally drop. Rolling it here rather than
        # assuming max_tier matters enormously: wave 1's weights are 65%
        # common / 1% epic, so taking the max would hand out an epic with
        # every single wave-1 bundle.
        bundle_tier = _weighted_tier(weights, rng)
    else:
        bundle_tier = max(0, min(forced_tier, max_tier))
    bundle_tier = min(bundle_tier, max_tier)

    picked: List[str] = []

    def pick_from_pool(curse: bool, tier: int) -> Optional[str]:
        for t in range(tier, -1, -1):
            candidates = [
                u["id"] for u in UPGRADES.values()
                if bool(u.get("curse")) == curse
                and u["rarity"] == RARITY_ORDER[t]
                and u["id"] not in picked
                and not u.get("starting")
                and not policy.rejects(u["id"])
                and can_apply_upgrade(u["id"], upgrades + picked, "bullet")
            ]
            if candidates:
                return rng.choice(candidates)
        return None

    first = pick_from_pool(curse=False, tier=bundle_tier)
    if first:
        picked.append(first)

    weight_sum = sum(weights.get(RARITY_ORDER[t], 0) for t in range(bundle_tier + 1)) or 1.0

    def roll_item_tier() -> int:
        roll = rng.random() * weight_sum
        for t in range(bundle_tier + 1):
            roll -= weights.get(RARITY_ORDER[t], 0)
            if roll <= 0:
                return t
        return 0

    for _ in range(1, rng.randint(1, 4)):
        item = pick_from_pool(curse=rng.random() < 0.3, tier=roll_item_tier())
        if item:
            picked.append(item)
    return picked


@dataclass
class RunResult:
    waves: List[Dict[str, float]] = field(default_factory=list)
    variant: Optional[str] = None
    variant_wave: Optional[int] = None
    variant_source: Optional[str] = None      # "shop" | "bundle"
    variant_offered_wave: Optional[int] = None  # first genuine shop offer, injections excluded
    final_upgrades: List[str] = field(default_factory=list)
    points_earned: int = 0
    points_spent: int = 0
    points_rerolled: int = 0
    bundles: int = 0
    curses: int = 0
    free_upgrades: int = 0


def simulate_one_run(max_wave: int, difficulty: Difficulty, policy: Policy,
                     force_variant_wave: Optional[int], rng: random.Random) -> RunResult:
    """Play one run from wave 1 to max_wave and record a snapshot per wave."""
    upgrades = list(STARTING_UPGRADES)
    points = STARTING_POINTS
    result = RunResult()

    for wave in range(1, max_wave + 1):
        # --- Pre-wave shop: roll, buy, optionally reroll, repeat ------------
        rerolls = 0
        while True:
            offer = _quiet(SERVICE._roll_upgrades, upgrades, "bullet", wave, difficulty)

            # A forced cohort has to actually GET its variant, and the shop
            # almost never offers one on its own - a specific epic is roughly
            # 0.2% of a slot, so ~6% of runs see one by wave 10. So the
            # variant is injected into the offer from --force-variant-wave on
            # (wave 1 by default) until it's bought, which also holds the
            # acquisition wave constant across cohorts - without that, the
            # comparison mostly measures who got their variant earlier.
            injected_this_roll = False
            if (policy.forced_variant and wave >= (force_variant_wave or 1)
                    and policy.forced_variant not in upgrades
                    and can_apply_upgrade(policy.forced_variant, upgrades, "bullet")):
                injected = get_upgrade(policy.forced_variant)
                if injected and all(u["id"] != policy.forced_variant for u in offer):
                    offer = [injected] + list(offer)[:-1]
                    injected_this_roll = True

            # Recorded before the injection above would contaminate it, so
            # this stays a measurement of how often the SHOP naturally offers
            # a variant - which is a separate balance question from whether
            # the variant is any good once you have it.
            if result.variant_offered_wave is None and not injected_this_roll:
                for upgrade in offer:
                    if upgrade["id"] in BULLET_VARIANTS.values():
                        result.variant_offered_wave = wave
                        break

            bought = 0
            while True:
                choice = policy.choose(offer, upgrades, points, wave, rng)
                if not choice:
                    break
                points -= choice.get("cost", 0)
                result.points_spent += choice.get("cost", 0)
                upgrades.append(choice["id"])
                offer = [u for u in offer if u is not choice]
                bought += 1
                if choice["id"] in BULLET_VARIANTS.values() and result.variant is None:
                    result.variant = choice["id"]
                    result.variant_wave = wave
                    result.variant_source = "injected" if injected_this_roll else "shop"

            if not policy.wants_reroll(points, bought, rerolls):
                break
            points -= REROLL_COST
            result.points_rerolled += REROLL_COST
            rerolls += 1

        # --- Wave: spawn, income, bundles -----------------------------------
        roster = sample_spawn_composition(wave, difficulty, rng)

        earned = roll_points(wave, roster, rng)
        points += earned
        result.points_earned += earned

        for forced_tier in roll_bundle_drops(wave, roster, difficulty, rng):
            granted = roll_bundle_contents(wave, difficulty, upgrades, forced_tier, policy, rng)
            result.bundles += 1
            for uid in granted:
                upgrades.append(uid)
                result.free_upgrades += 1
                if (UPGRADES.get(uid) or {}).get("curse"):
                    result.curses += 1
                # Bundles hand out variants for free too - the natural cohort
                # gets most of its variants this way, not from the shop.
                if uid in BULLET_VARIANTS.values() and result.variant is None:
                    result.variant = uid
                    result.variant_wave = wave
                    result.variant_source = "bundle"

        # --- Free evolution milestone ---------------------------------------
        if wave % MILESTONE_EVERY == 0 and can_apply_upgrade(MILESTONE_UPGRADE, upgrades, "bullet"):
            upgrades.append(MILESTONE_UPGRADE)
            result.free_upgrades += 1

        # --- Snapshot --------------------------------------------------------
        snapshot = build_damage_profile(upgrades)
        snapshot["wave"] = wave
        # Enemy pressure uses the exact functions a real WaveSnapshot uses, so
        # these columns line up with damage_scaling_ratio.py on real runs.
        snapshot["enemy_health_multiplier"] = difficulty.get_health_multiplier(wave - 1)
        snapshot["enemy_damage_multiplier"] = difficulty.get_damage_multiplier(wave - 1)
        snapshot["enemy_total_health_spawned"] = float(
            calculate_expected_health_spawned(wave, difficulty)
        )
        snapshot["enemy_health_spawned_ex_boss"] = snapshot["enemy_total_health_spawned"] - _boss_health(
            wave, difficulty
        )
        snapshot["points_balance"] = float(points)
        result.waves.append(snapshot)

    result.final_upgrades = upgrades
    return result


def _boss_health(wave: int, difficulty: Difficulty) -> float:
    """Scheduled boss spawns' effective health, matching damage_scaling_ratio.py."""
    def effective(enemy_type: str) -> float:
        health = float(get_enemy_health(enemy_type, wave, difficulty))
        if enemy_type in ("hexagon", "super_hexagon"):
            health += int(health * HEXAGON_SHIELD_RATIO)
        for child in get_split_children(enemy_type):
            child_health = float(get_enemy_health(child, wave, difficulty))
            if child in ("hexagon", "super_hexagon"):
                child_health += int(child_health * HEXAGON_SHIELD_RATIO)
            health += child_health
        return health

    return sum(effective(t) for t in (difficulty.get_scheduled_boss_spawns(wave) or []))


# ---------------------------------------------------------------------------
# Aggregation and reporting
# ---------------------------------------------------------------------------

FOLD_BASE_KEYS = [
    "expected_discharge_damage",
    "damage_per_projectile",
    "enemy_health_multiplier",
    "enemy_total_health_spawned",
    "enemy_health_spawned_ex_boss",
    "effective_ehp",
    "enemy_damage_multiplier",
]

DETAIL_KEYS = [
    "damage_per_projectile",
    "damage_per_projectile_spawn_with_pierce",
    "explosion_damage",
    "buckshot_single_pellet_damage",
    "buckshot_projectile_minimum_damage",
    "buckshot_projectile_maximum_damage",
    "homing_bullet_maximum_damage",
    "homing_bullet_minimum_damage",
    "total_discharge_damage",
    "expected_discharge_damage",
    "polygon_sides",
    "pierce",
    "max_health",
    "effective_ehp",
]


def add_folds(runs: List[RunResult]) -> None:
    """
    Turn each run's absolute values into fold-change vs its OWN wave 1, then
    the derived ratios. Per-run first, aggregated after - aggregating absolute
    values and dividing afterwards would let a single lucky run's magnitude
    dominate the ratio.
    """
    for run in runs:
        if not run.waves:
            continue
        base = {k: (run.waves[0].get(k) or 1.0) for k in FOLD_BASE_KEYS}
        for snapshot in run.waves:
            for key in FOLD_BASE_KEYS:
                snapshot[f"{key}__fold"] = (snapshot.get(key, 0.0)) / base[key]
            proj = snapshot["expected_discharge_damage__fold"]
            snapshot["vs_curve"] = proj / (snapshot["enemy_health_multiplier__fold"] or 1)
            snapshot["vs_pool"] = proj / (snapshot["enemy_total_health_spawned__fold"] or 1)
            snapshot["vs_pool_ex"] = proj / (snapshot["enemy_health_spawned_ex_boss__fold"] or 1)
            snapshot["ehp_vs_enemy_damage"] = (
                snapshot["effective_ehp__fold"] / (snapshot["enemy_damage_multiplier__fold"] or 1)
            )


def quantiles(values: List[float]) -> Tuple[float, float, float]:
    """(median, p25, p75), tolerant of tiny samples."""
    ordered = sorted(values)
    if len(ordered) == 1:
        return ordered[0], ordered[0], ordered[0]
    q = statistics.quantiles(ordered, n=4)
    return statistics.median(ordered), q[0], q[2]


def aggregate(runs: List[RunResult], key: str) -> Dict[int, Tuple[float, float, float]]:
    by_wave: Dict[int, List[float]] = defaultdict(list)
    for run in runs:
        for snapshot in run.waves:
            if key in snapshot:
                by_wave[int(snapshot["wave"])].append(snapshot[key])
    return {wave: quantiles(values) for wave, values in sorted(by_wave.items())}


def print_cohort_comparison(cohorts: Dict[str, List[RunResult]], key: str,
                            title: str, subtitle: str, unit: str = "x",
                            fmt: str = "{:.2f}") -> None:
    names = [c for c in COHORTS if c in cohorts]
    tables = {name: aggregate(cohorts[name], key) for name in names}
    waves = sorted({w for t in tables.values() for w in t})

    print(f"\n{title}")
    print(f"  {subtitle}")
    print(f"{'wave':>5}  " + "  ".join(f"{n:>13}" for n in names))
    for wave in waves:
        cells = []
        for name in names:
            row = tables[name].get(wave)
            cells.append(f"{fmt.format(row[0]) + unit:>13}" if row else f"{'-':>13}")
        print(f"{wave:>5}  " + "  ".join(cells))


def print_detail(name: str, runs: List[RunResult]) -> None:
    print(f"\n--- {name}: per-wave detail (median) ---")
    tables = {key: aggregate(runs, key) for key in DETAIL_KEYS}
    waves = sorted(tables["expected_discharge_damage"])
    labels = {
        "damage_per_projectile": "dmg/proj",
        "damage_per_projectile_spawn_with_pierce": "dmg/spawn+pierce",
        "explosion_damage": "explosion",
        "buckshot_single_pellet_damage": "bs pellet",
        "buckshot_projectile_minimum_damage": "bs proj min",
        "buckshot_projectile_maximum_damage": "bs proj max",
        "homing_bullet_maximum_damage": "hm max",
        "homing_bullet_minimum_damage": "hm min",
        "total_discharge_damage": "total dischg",
        "expected_discharge_damage": "expected dischg",
        "polygon_sides": "sides",
        "pierce": "pierce",
        "max_health": "max hp",
        "effective_ehp": "eff ehp",
    }
    # Drop columns that are zero everywhere (a non-buckshot cohort has no
    # pellet numbers) so the table stays readable.
    active = [k for k in DETAIL_KEYS if any(tables[k].get(w, (0,))[0] for w in waves)]
    print(f"{'wave':>5}  " + "  ".join(f"{labels[k]:>16}" for k in active))
    for wave in waves:
        print(f"{wave:>5}  " + "  ".join(f"{tables[k].get(wave, (0,))[0]:>16.2f}" for k in active))


def print_build_summary(cohorts: Dict[str, List[RunResult]]) -> None:
    print("\n--- build trajectory (median across runs) ---")
    print(f"{'cohort':>10}  {'variant':>16}  {'picked':>7}  {'1st offer':>9}  "
          f"{'earned':>7}  {'spent':>6}  {'reroll':>6}  {'bundles':>7}  {'free':>5}  {'curses':>6}")
    for name in COHORTS:
        runs = cohorts.get(name)
        if not runs:
            continue
        variants = Counter(r.variant or "none" for r in runs)
        top_variant, top_count = variants.most_common(1)[0]
        picked_waves = [r.variant_wave for r in runs if r.variant_wave]
        offered_waves = [r.variant_offered_wave for r in runs if r.variant_offered_wave]
        label = top_variant.replace("_bullets", "")
        if name == "natural":
            label += f" {top_count / len(runs):.0%}"
        print(
            f"{name:>10}  {label:>16}  "
            f"{(statistics.median(picked_waves) if picked_waves else 0):>7.0f}  "
            f"{(statistics.median(offered_waves) if offered_waves else 0):>9.0f}  "
            f"{statistics.median(r.points_earned for r in runs):>7.0f}  "
            f"{statistics.median(r.points_spent for r in runs):>6.0f}  "
            f"{statistics.median(r.points_rerolled for r in runs):>6.0f}  "
            f"{statistics.median(r.bundles for r in runs):>7.0f}  "
            f"{statistics.median(r.free_upgrades for r in runs):>5.0f}  "
            f"{statistics.median(r.curses for r in runs):>6.0f}"
        )

    natural = cohorts.get("natural")
    if natural:
        total = len(natural)
        print("\n--- how variants are actually acquired (unforced cohort) ---")
        print("  a weak variant and a never-offered variant are different bugs with")
        print("  different fixes, so acquisition is reported separately from power.")
        taken = Counter(r.variant for r in natural if r.variant)
        print(f"    {'variant':<20} {'acquired':>9}  {'median wave':>11}")
        for variant in BULLET_VARIANTS.values():
            waves = [r.variant_wave for r in natural if r.variant == variant and r.variant_wave]
            median_wave = f"{statistics.median(waves):.0f}" if waves else "-"
            print(f"    {variant:<20} {taken.get(variant, 0) / total:>8.1%}  {median_wave:>11}")
        print(f"    {'(none)':<20} {sum(1 for r in natural if not r.variant) / total:>8.1%}")

        sources = Counter(r.variant_source for r in natural if r.variant_source)
        shop = sources.get("shop", 0)
        bundle = sources.get("bundle", 0)
        print(f"\n    source: {shop / total:>6.1%} bought in the shop, "
              f"{bundle / total:>6.1%} granted free by a bundle")
        offered = sum(1 for r in natural if r.variant_offered_wave)
        print(f"    the shop offered a variant at all in {offered / total:.1%} of runs")


def print_final_upgrades(name: str, runs: List[RunResult]) -> None:
    print(f"\n--- {name}: most-owned upgrades at the end (mean stacks/run) ---")
    totals: Counter = Counter()
    for run in runs:
        totals.update(run.final_upgrades)
    for uid, count in totals.most_common(20):
        upgrade = get_upgrade(uid) or {}
        tag = " [curse]" if upgrade.get("curse") else ""
        print(f"    {uid:<38} {count / len(runs):>6.2f}  ({upgrade.get('rarity', '?')}){tag}")


def write_csv(path: str, cohorts: Dict[str, List[RunResult]]) -> None:
    keys = DETAIL_KEYS + [f"{k}__fold" for k in FOLD_BASE_KEYS] + [
        "vs_curve", "vs_pool", "vs_pool_ex", "ehp_vs_enemy_damage",
        "enemy_health_multiplier", "enemy_total_health_spawned", "points_balance",
    ]
    with open(path, "w", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(["cohort", "wave", "metric", "median", "p25", "p75", "runs"])
        for name, runs in cohorts.items():
            for key in keys:
                for wave, (median, p25, p75) in aggregate(runs, key).items():
                    writer.writerow([name, wave, key, f"{median:.4f}",
                                     f"{p25:.4f}", f"{p75:.4f}", len(runs)])
    print(f"\nwrote {path}")


# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("--wave", type=int, default=30, help="simulate up to this wave")
    parser.add_argument("--runs", type=int, default=500, help="runs per cohort")
    parser.add_argument("--variant", default="all",
                        choices=["all"] + COHORTS,
                        help="'all' runs every cohort side by side (default)")
    parser.add_argument("--force-variant-wave", type=int, default=None,
                        help="inject the forced variant into the offer from this wave on, "
                             "so every cohort acquires it at the same time")
    parser.add_argument("--policy", default="greedy-damage",
                        choices=["greedy-damage", "pickrate"])
    parser.add_argument("--difficulty", default="normal")
    parser.add_argument("--seed", type=int, default=1234)
    parser.add_argument("--detail", action="store_true",
                        help="also print each cohort's full per-wave damage breakdown")
    parser.add_argument("--csv", default=None)
    args = parser.parse_args()

    difficulty = get_difficulty(args.difficulty)
    rates = load_pick_rates(args.difficulty) if args.policy == "pickrate" else None
    names = COHORTS if args.variant == "all" else [args.variant]

    print(f"simulating {args.runs} run(s) x {len(names)} cohort(s) to wave {args.wave}  "
          f"[{args.difficulty}, policy={args.policy}, seed={args.seed}"
          + (f", variant forced from wave {args.force_variant_wave}" if args.force_variant_wave else "")
          + "]")

    cohorts: Dict[str, List[RunResult]] = {}
    for name in names:
        forced = BULLET_VARIANTS.get(name)
        allow = name != "none"
        if args.policy == "pickrate":
            policy = PickRatePolicy(forced, allow, rates)
        else:
            policy = GreedyDamagePolicy(forced, allow)

        runs = []
        for index in range(args.runs):
            # Same seed sequence in every cohort: run #N sees identical shop
            # and bundle luck regardless of which variant is forced, so a
            # cohort gap is the variant and not the dice.
            rng = random.Random(args.seed + index)
            random.seed(args.seed + index)  # WaveService._roll_upgrades uses the global RNG
            runs.append(simulate_one_run(args.wave, difficulty, policy,
                                         args.force_variant_wave, rng))
        add_folds(runs)
        cohorts[name] = runs

    print_cohort_comparison(
        cohorts, "expected_discharge_damage",
        "=== expected damage per discharge, absolute (median) ===",
        "which variant is STRONGER. this is the column to compare across cohorts.",
        unit="", fmt="{:,.0f}",
    )
    print_cohort_comparison(
        cohorts, "expected_discharge_damage__fold",
        "=== damage output, fold-change vs each run's own wave 1 (median) ===",
        "how much each build GREW, not how strong it is - a cohort that starts "
        "strong (explosive owns its variant on wave 1) shows a smaller fold "
        "while being ahead in absolute terms. read this per column, not across.",
    )
    print_cohort_comparison(
        cohorts, "vs_curve",
        "=== vs_curve: damage fold / per-enemy health curve (median) ===",
        ">1.0 means damage is outscaling the difficulty curve. 1.0 is perfectly balanced.",
    )
    print_cohort_comparison(
        cohorts, "vs_pool_ex",
        "=== vs_pool_ex: damage fold / wave health pool, bosses excluded (median) ===",
        ">1.0 means damage is outscaling total wave pressure.",
    )
    print_cohort_comparison(
        cohorts, "ehp_vs_enemy_damage",
        "=== ehp_vs_enemy_damage: player EHP fold / enemy damage fold (median) ===",
        "<1.0 means the player is getting squishier relative to enemies.",
    )

    print_build_summary(cohorts)

    if args.detail or len(names) == 1:
        for name in names:
            print_detail(name, cohorts[name])
            print_final_upgrades(name, cohorts[name])

    if args.csv:
        write_csv(args.csv, cohorts)


if __name__ == "__main__":
    main()
