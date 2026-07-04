from ..upgrade_implementation import UpgradeImplementation, UpgradeAppliers


class Damage3(UpgradeImplementation):
    id = 'damage_3'
    name = 'Devastation'
    description = '+1.6% damage.'
    rarity = 'rare'
    type = 'stat_modifier'
    cost = 10

    def can_apply(self, state: dict) -> bool:
        return True

    def apply(self, appliers: UpgradeAppliers) -> None:
        value = 0.016
        appliers.modifiers.add_multiplier('attack', 'damage', value)

    def validate(self, recorded_stats: dict) -> bool:
        return True
