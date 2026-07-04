from ..upgrade_implementation import UpgradeImplementation, UpgradeAppliers


class Knockback3(UpgradeImplementation):
    id = 'knockback_3'
    name = 'Knockback Boost'
    description = '+50% knockback'
    rarity = 'rare'
    type = 'stat_modifier'
    cost = 10

    def can_apply(self, state: dict) -> bool:
        return True

    def apply(self, appliers: UpgradeAppliers) -> None:
        value = 0.5
        appliers.modifiers.add_multiplier('attack', 'knockback', value)

    def validate(self, recorded_stats: dict) -> bool:
        return True
