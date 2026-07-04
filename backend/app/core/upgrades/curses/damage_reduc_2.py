from ..upgrade_implementation import UpgradeImplementation, UpgradeAppliers


class DamageReduc2(UpgradeImplementation):
    id = 'damage_reduc_2'
    name = 'Weakness 2'
    description = '-0.4% damage.'
    rarity = 'uncommon'
    type = 'stat_modifier'
    cost = 0

    def can_apply(self, state: dict) -> bool:
        return True

    def apply(self, appliers: UpgradeAppliers) -> None:
        value = -0.004
        appliers.modifiers.add_multiplier('attack', 'damage', value)

    def validate(self, recorded_stats: dict) -> bool:
        return True
