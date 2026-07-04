from abc import ABC, abstractmethod
from typing import Dict, Any

Rarity = str  # 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'


class UpgradeModifierSystem:
    """Stub implementation for now - will be integrated with real system"""

    def add_multiplier(self, target: str, stat: str, value: float) -> None:
        pass

    def apply_modifiers(self, target: str, stat: str, base_value: float) -> float:
        return base_value


class EffectSystem:
    """Stub implementation for now - will be integrated with real system"""

    def register_effect(self, effect_id: str, config: Dict[str, Any]) -> None:
        pass


class VariantSystem:
    """Stub implementation for now - will be integrated with real system"""

    def set_active(self, variant_type: str, variant_class: str) -> None:
        pass


class UpgradeAppliers:
    """Container for systems to apply upgrade effects to"""

    def __init__(self):
        self.modifiers = UpgradeModifierSystem()
        self.effects = EffectSystem()
        self.variants = VariantSystem()


class UpgradeImplementation(ABC):
    """
    Base class for all upgrade implementations.

    Same pattern as frontend - each upgrade is a class implementing:
    - can_apply(): Can this upgrade be added?
    - apply(): Add this upgrade's effects to current calculations
    - validate(): Prove this upgrade worked during the wave
    """

    id: str
    name: str
    description: str
    rarity: Rarity
    type: str
    cost: int

    @abstractmethod
    def can_apply(self, state: dict) -> bool:
        """
        Can this upgrade be offered/purchased right now?

        Args:
            state: Current player state

        Returns:
            True if upgrade can be added
        """
        pass

    @abstractmethod
    def apply(self, appliers: UpgradeAppliers) -> None:
        """
        Apply this upgrade's stat/effect changes.

        Called during stat calculation. Add modifiers, register effects, etc.

        Args:
            appliers: Systems to apply changes to (modifiers, effects, variants)
        """
        pass

    @abstractmethod
    def validate(self, recorded_stats: dict) -> bool:
        """
        Prove this upgrade actually worked during the wave.

        Args:
            recorded_stats: Stats recorded during the wave

        Returns:
            True if stats match what this upgrade would produce
        """
        pass
