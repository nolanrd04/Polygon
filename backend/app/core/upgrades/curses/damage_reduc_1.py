from ..upgrade_implementation import UpgradeImplementation, UpgradeAppliers


class DamageReduc1(UpgradeImplementation):
    id = 'damage_reduc_1'
    name = 'Weaknes 1'
    description = '-0.1% damage.'
    rarity = 'common'
    type = 'stat_modifier'
    cost = 0

    def can_apply(self, state: dict) -> bool:
        return True

    def apply(self, appliers: UpgradeAppliers) -> None:
        value = -0.001
        appliers.modifiers.add_multiplier('attack', 'damage', value)

    def validate(self, recorded_stats: dict) -> bool:
        return True
