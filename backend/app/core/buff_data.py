"""
Buff definitions and the bundle buff whitelist, generated from the frontend
(frontend/src/game/buffs/) by scripts/buff_defs_sync.py into data/buffs.json.
Don't edit buffs.json by hand; change the frontend def and re-run the script.

The roll logic for bundle drops lives in buff_rolls.py.
"""

from typing import Any, Dict, List, Optional
import json
from pathlib import Path


def _load_buffs() -> Dict[str, Any]:
    data_path = Path(__file__).parent / "data" / "buffs.json"
    with open(data_path) as f:
        return json.load(f)


_DATA = _load_buffs()

BUFFS: Dict[str, Dict[str, Any]] = _DATA["buffs"]
BUNDLE_BUFF_DROPS: List[Dict[str, Any]] = _DATA["bundleDrops"]
DROP_DEFAULTS: Dict[str, int] = _DATA["dropDefaults"]

# Mirrors FIXED_STEP_MS / msToTicks in the frontend: buff timers count 60 Hz logic ticks.
LOGIC_HZ = 60


def get_buff(buff_id: str) -> Optional[Dict[str, Any]]:
    return BUFFS.get(buff_id)


def ms_to_ticks(ms: float) -> int:
    return max(0, int(round(ms * LOGIC_HZ / 1000)))