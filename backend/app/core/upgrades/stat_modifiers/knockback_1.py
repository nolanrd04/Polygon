from ..upgrade_implementation import UpgradeImplementation, UpgradeAppliers


class Knockback1(UpgradeImplementation):
    id = 'knockback_1'
    name = 'Knockback Boost'
    description = '+5% knockback'
    rarity = 'common'
    type = 'stat_modifier'
    cost = 2

    def can_apply(self, state: dict) -> bool:
        return True

    def apply(self, appliers: UpgradeAppliers) -> None:
        value = 0.05
        appliers.modifiers.add_multiplier('attack', 'knockback', value)

    def validate(self, recorded_stats: dict) -> bool:
        return True
