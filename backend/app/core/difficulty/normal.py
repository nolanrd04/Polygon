"""
Mirrors frontend/src/game/systems/difficulty/Normal.ts — keep both in sync.
Wave-keyed lookup tables live in app/core/data/difficulty_normal.json and
app/core/data/rarity_weights.json; the tiered formulas (spawn delay, bundle
drop chance, wave-scaling multipliers) are ported as code since that's how
Normal.ts itself implements them.
"""

import json
import math
from pathlib import Path
from typing import Dict, List, Optional

from app.core.difficulty.base import Difficulty, EnemySpawnWeight, RarityWeights


def _load_data() -> dict:
    data_path = Path(__file__).parent.parent / "data" / "difficulty_normal.json"
    with open(data_path) as f:
        return json.load(f)


def _load_rarity_weights() -> tuple[Dict[int, RarityWeights], RarityWeights]:
    data_path = Path(__file__).parent.parent / "data" / "rarity_weights.json"
    with open(data_path) as f:
        data = json.load(f)
    return {int(k): v for k, v in data["by_wave"].items()}, data["fallback"]


_DATA = _load_data()
ENEMY_COUNTS: Dict[int, int] = {int(k): v for k, v in _DATA["enemy_counts"].items()}
SPAWN_WEIGHTS: Dict[int, List[EnemySpawnWeight]] = {int(k): v for k, v in _DATA["spawn_weights"].items()}
FALLBACK_SPAWN_WEIGHTS: List[EnemySpawnWeight] = _DATA["fallback_spawn_weights"]
SCHEDULED_BOSS_SPAWNS: Dict[int, List[str]] = {int(k): v for k, v in _DATA["scheduled_boss_spawns"].items()}
BUNDLE_RARITY_WEIGHTS_BY_WAVE: Dict[int, RarityWeights] = {int(k): v for k, v in _DATA["bundle_rarity_weights"].items()}
FALLBACK_BUNDLE_RARITY_WEIGHTS: RarityWeights = _DATA["fallback_bundle_rarity_weights"]
RARITY_WEIGHTS_BY_WAVE, FALLBACK_RARITY_WEIGHTS = _load_rarity_weights()


class NormalDifficulty(Difficulty):
    id = "normal"
    label = "Normal"

    def get_enemy_count(self, wave: int) -> int:
        explicit = ENEMY_COUNTS.get(wave)
        if explicit is not None:
            return explicit
        return int(100 + wave * 2 + wave ** 1.2)

    def get_spawn_weights(self, wave: int) -> List[EnemySpawnWeight]:
        return SPAWN_WEIGHTS.get(wave, FALLBACK_SPAWN_WEIGHTS)

    def get_spawn_delay(self, wave: int) -> int:
        # Earlier waves use gentler scaling so the very first waves don't feel frantic.
        if wave < 30:
            return max(50, 1000 - wave * 25)
        elif wave < 40:
            return max(50, 1000 - wave * 35)
        elif wave < 50:
            return max(50, 1000 - wave * 45)
        return max(50, 1000 - wave * 50)

    def get_scheduled_boss_spawns(self, wave: int) -> Optional[List[str]]:
        return SCHEDULED_BOSS_SPAWNS.get(wave)

    def get_rarity_weights(self, wave: int) -> RarityWeights:
        return RARITY_WEIGHTS_BY_WAVE.get(wave, FALLBACK_RARITY_WEIGHTS)

    def get_bundle_drop_chance(self, wave: int) -> float:
        if wave <= 4:
            return 0.12
        if wave <= 9:
            return 0.1
        if wave <= 14:
            return 0.07
        if wave <= 19:
            return 0.05
        if wave <= 24:
            return 0.04
        return 0.03

    def get_bundle_rarity_weights(self, wave: int) -> RarityWeights:
        return BUNDLE_RARITY_WEIGHTS_BY_WAVE.get(wave, FALLBACK_BUNDLE_RARITY_WEIGHTS)

    def get_health_multiplier(self, wave: int) -> float:
        return math.exp(wave / 8)

    def get_damage_multiplier(self, wave: int) -> float:
        return math.exp(wave / 8)

    def get_speed_multiplier(self, wave: int, speed_cap: float) -> float:
        return min(speed_cap, 1 + wave * 0.05)
