from ..upgrade_implementation import UpgradeImplementation, UpgradeAppliers


class Damage2(UpgradeImplementation):
    id = 'damage_2'
    name = 'Devastation'
    description = '+0.8% damage.'
    rarity = 'uncommon'
    type = 'stat_modifier'
    cost = 6

    def can_apply(self, state: dict) -> bool:
        return True

    def apply(self, appliers: UpgradeAppliers) -> None:
        value = 0.008
        appliers.modifiers.add_multiplier('attack', 'damage', value)

    def validate(self, recorded_stats: dict) -> bool:
        return True
