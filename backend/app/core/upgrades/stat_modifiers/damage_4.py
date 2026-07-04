from ..upgrade_implementation import UpgradeImplementation, UpgradeAppliers


class Damage4(UpgradeImplementation):
    id = 'damage_4'
    name = 'Devastation'
    description = '+3.5% damage.'
    rarity = 'epic'
    type = 'stat_modifier'
    cost = 20

    def can_apply(self, state: dict) -> bool:
        return True

    def apply(self, appliers: UpgradeAppliers) -> None:
        value = 0.035
        appliers.modifiers.add_multiplier('attack', 'damage', value)

    def validate(self, recorded_stats: dict) -> bool:
        return True
