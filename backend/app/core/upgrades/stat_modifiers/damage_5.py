from ..upgrade_implementation import UpgradeImplementation, UpgradeAppliers


class Damage5(UpgradeImplementation):
    id = 'damage_5'
    name = 'Devastation'
    description = '+7.5% damage.'
    rarity = 'legendary'
    type = 'stat_modifier'
    cost = 40

    def can_apply(self, state: dict) -> bool:
        return True

    def apply(self, appliers: UpgradeAppliers) -> None:
        value = 0.075
        appliers.modifiers.add_multiplier('attack', 'damage', value)

    def validate(self, recorded_stats: dict) -> bool:
        return True
