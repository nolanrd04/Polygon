from ..upgrade_implementation import UpgradeImplementation, UpgradeAppliers


class DamageReduc5(UpgradeImplementation):
    id = 'damage_reduc_5'
    name = 'Weakness 5'
    description = '-3.75% damage.'
    rarity = 'legendary'
    type = 'stat_modifier'
    cost = 0

    def can_apply(self, state: dict) -> bool:
        return True

    def apply(self, appliers: UpgradeAppliers) -> None:
        value = -0.0375
        appliers.modifiers.add_multiplier('attack', 'damage', value)

    def validate(self, recorded_stats: dict) -> bool:
        return True
