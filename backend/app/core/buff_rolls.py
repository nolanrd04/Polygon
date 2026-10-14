"""
Bundle buff rolls, hand-ported from frontend/src/game/buffs/bundleDrops.ts.

The tables (durations, defs) come from buffs.json via buff_data.py. This file
holds the logic: the default roll (rollDropDuration) and one handler per
BUNDLE_BUFF_DROPS entry that has a custom `roll`, ported 1:1 the same way
difficulty/normal.py ports Normal.ts. scripts/buff_defs_sync.py fails if an
entry has a `roll` with no handler in ROLLS.

Kept free of app imports so the sync script can load ROLLS on its own.
"""

import random
from typing import Any, Callable, Dict, List, Optional, TypedDict


class BuffRollContext(TypedDict):
    """Mirrors BundleBuffRollContext. Only things the server knows."""
    wave: int
    difficulty_id: str
    upgrades: List[str]


class BuffRoll(TypedDict):
    """Mirrors BundleBuffRoll. `duration` is ms, `stats` maps stat id -> value."""
    buff: str
    duration: int
    stats: Dict[str, float]


RollHandler = Callable[[Dict[str, Any], BuffRollContext, Dict[str, int]], BuffRoll]

# Keyed by BuffID value. Empty until an entry in bundleDrops.ts gets a `roll`.
ROLLS: Dict[str, RollHandler] = {}


def roll_drop_duration(drop: Dict[str, Any], defaults: Dict[str, int]) -> int:
    """Port of rollDropDuration: uniform in [minDuration, maxDuration], whole ms."""
    low = drop.get("minDuration", defaults["minDuration"])
    high = max(low, drop.get("maxDuration", defaults["maxDuration"]))
    return int(round(low + random.random() * (high - low)))


def roll_drop(drop: Dict[str, Any], ctx: BuffRollContext, defaults: Dict[str, int]) -> BuffRoll:
    """Port of rollDrop: the entry's handler, else the default duration roll."""
    handler: Optional[RollHandler] = ROLLS.get(drop["buff"]) if drop.get("hasRoll") else None
    if handler:
        return handler(drop, ctx, defaults)
    return {"buff": drop["buff"], "duration": roll_drop_duration(drop, defaults), "stats": {}}