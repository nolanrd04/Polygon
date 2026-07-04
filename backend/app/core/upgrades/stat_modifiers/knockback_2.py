from ..upgrade_implementation import UpgradeImplementation, UpgradeAppliers


class Knockback2(UpgradeImplementation):
    id = 'knockback_2'
    name = 'Knockback Boost'
    description = '+20% knockback'
    rarity = 'uncommon'
    type = 'stat_modifier'
    cost = 6

    def can_apply(self, state: dict) -> bool:
        return True

    def apply(self, appliers: UpgradeAppliers) -> None:
        value = 0.2
        appliers.modifiers.add_multiplier('attack', 'knockback', value)

    def validate(self, recorded_stats: dict) -> bool:
        return True
