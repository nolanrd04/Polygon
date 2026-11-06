"""
Upgrade definitions for backend upgrade rolling and validation.
This matches the frontend upgrade JSON files in
frontend/src/game/data/upgrades/.

Per-wave rarity weights come from the active Difficulty (app.core.difficulty),
which mirrors the frontend Difficulty implementation
(frontend/src/game/systems/difficulty/Normal.ts — getRarityWeights).

Game data is loaded from JSON files in app/core/data/ for better modularity.
Keep these data files in sync with the frontend whenever upgrade values change.
"""

from typing import Dict, List, Any
import json
import math
import random
from pathlib import Path

from app.core.difficulty.base import Difficulty


def _load_upgrades() -> Dict[str, Dict[str, Any]]:
    data_path = Path(__file__).parent / "data" / "upgrades.json"
    with open(data_path) as f:
        return json.load(f)

UPGRADES = _load_upgrades()

# Upgrades every run begins with instead of buying (heal_ability). Mirrors the
# frontend's `starting: true` defs, which UpgradeSystem.grantStartingUpgrades()
# applies at run start. These are seeded into a new save's current_upgrades,
# always count as authorized, and are excluded from the wave offer pool.
STARTING_UPGRADES: List[str] = sorted(
    upgrade_id for upgrade_id, upgrade in UPGRADES.items() if upgrade.get("starting")
)


def get_upgrade(upgrade_id: str) -> Dict[str, Any] | None:
    """Get upgrade definition by ID"""
    return UPGRADES.get(upgrade_id)


def get_roll_cost(upgrade: Dict[str, Any], discounted: bool, difficulty: Difficulty) -> int:
    """What an upgrade costs when bought from a rolled offer."""
    cost = upgrade.get("cost", 0)
    if not discounted:
        return cost
    return math.ceil(cost * (100 - difficulty.roll_discount_percent) / 100)


def roll_offer_discounts(offers: List[Dict[str, Any]], difficulty: Difficulty) -> List[Dict[str, Any]]:
    """
    Copies of the offered upgrades with their discount rolled. One roll per id:
    a stackable can be offered twice and buying matches by id, so its cards
    must share a price. Copies, because the offers are the shared UPGRADES defs.
    """
    rolls: Dict[str, bool] = {}
    return [
        {**offer, "discounted": rolls.setdefault(offer["id"], random.random() < difficulty.roll_discount_chance)}
        for offer in offers
    ]


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

    # Check dependencies — every group must be satisfied (AND across groups);
    # within a group, `count` of `ids` must be owned (OR/threshold, default 1).
    # An id may be a {"id", "minStacks"} object requiring a stack count instead
    # of plain ownership.
    if upgrade.get("dependentOn"):
        for group in upgrade["dependentOn"]:
            required = group.get("count", 1)
            met = 0
            for item in group["ids"]:
                if isinstance(item, dict):
                    if current_upgrades.count(item["id"]) >= item["minStacks"]:
                        met += 1
                elif item in current_upgrades:
                    met += 1
            if met < required:
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
