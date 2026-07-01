"""
Upgrade definitions for backend upgrade rolling and validation.
This matches the frontend upgrade JSON files in
frontend/src/game/data/upgrades/.

Per-wave rarity weights mirror the frontend Difficulty implementation
(frontend/src/game/systems/difficulty/Normal.ts — getRarityWeights).

Game data is loaded from JSON files in app/core/data/ for better modularity.
Keep these data files in sync with the frontend whenever upgrade values change.
"""

from typing import Dict, List, Any
import json
from pathlib import Path

# Load rarity weights from JSON
def _load_rarity_weights() -> tuple[Dict[int, Dict[str, float]], Dict[str, float]]:
    data_path = Path(__file__).parent / "data" / "rarity_weights.json"
    with open(data_path) as f:
        data = json.load(f)

    by_wave = {int(k): v for k, v in data["by_wave"].items()}
    fallback = data["fallback"]
    return by_wave, fallback

RARITY_WEIGHTS_BY_WAVE, FALLBACK_RARITY_WEIGHTS = _load_rarity_weights()


def get_rarity_weights(wave: int) -> Dict[str, float]:
    return RARITY_WEIGHTS_BY_WAVE.get(wave, FALLBACK_RARITY_WEIGHTS)

def _load_upgrades() -> Dict[str, Dict[str, Any]]:
    data_path = Path(__file__).parent / "data" / "upgrades.json"
    with open(data_path) as f:
        return json.load(f)

UPGRADES = _load_upgrades()


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
