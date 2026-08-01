"""
A Difficulty owns all per-wave game-pacing data: how many enemies spawn,
which types, how fast, and what (if anything) is a scheduled boss spawn.

Mirrors frontend/src/game/systems/difficulty/Difficulty.ts — keep both in sync.
Add a new difficulty by creating a new module in this package that implements
this interface and registering it in app/core/difficulty/__init__.py.
"""

from abc import ABC, abstractmethod
from typing import Dict, List, Optional, TypedDict


class EnemySpawnWeight(TypedDict):
    type: str
    weight: float


RarityWeights = Dict[str, float]


class Difficulty(ABC):
    id: str
    label: str

    @abstractmethod
    def get_enemy_count(self, wave: int) -> int: ...

    @abstractmethod
    def get_spawn_weights(self, wave: int) -> List[EnemySpawnWeight]: ...

    @abstractmethod
    def get_spawn_delay(self, wave: int) -> int:
        """Milliseconds between enemy spawns for the given wave."""
        ...

    @abstractmethod
    def get_scheduled_boss_spawns(self, wave: int) -> Optional[List[str]]:
        """
        Enemy type IDs to spawn when the boss trigger fires, or None if this
        wave has no scheduled boss. The regular spawn pool still runs in
        parallel; this is just the "scripted" boss spawn.
        """
        ...

    @abstractmethod
    def get_rarity_weights(self, wave: int) -> RarityWeights:
        """Rarity weights used when rolling offered upgrades. Should sum to 1."""
        ...

    @abstractmethod
    def get_bundle_drop_chance(self, wave: int) -> float:
        """Chance (0-1) that any enemy drops an upgrade bundle on death."""
        ...

    @abstractmethod
    def get_bundle_rarity_weights(self, wave: int) -> RarityWeights:
        """Rarity weights for the tier of a dropped upgrade bundle."""
        ...

    @abstractmethod
    def get_health_multiplier(self, wave: int) -> float:
        """Multiplier for enemy health scaling, applied to each enemy's base health."""
        ...

    @abstractmethod
    def get_damage_multiplier(self, wave: int) -> float:
        """Multiplier for enemy damage scaling, applied to each enemy's base damage."""
        ...

    @abstractmethod
    def get_speed_multiplier(self, wave: int, speed_cap: float) -> float:
        """Multiplier for enemy speed scaling, capped by each enemy's individual speed cap."""
        ...
