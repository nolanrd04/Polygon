from ..upgrade_implementation import UpgradeImplementation, UpgradeAppliers


class DamageReduc4(UpgradeImplementation):
    id = 'damage_reduc_4'
    name = 'Weakness 4'
    description = '-1.75% damage.'
    rarity = 'epic'
    type = 'stat_modifier'
    cost = 0

    def can_apply(self, state: dict) -> bool:
        return True

    def apply(self, appliers: UpgradeAppliers) -> None:
        value = -0.0175
        appliers.modifiers.add_multiplier('attack', 'damage', value)

    def validate(self, recorded_stats: dict) -> bool:
        return True
