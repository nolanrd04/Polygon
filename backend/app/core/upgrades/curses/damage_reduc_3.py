from ..upgrade_implementation import UpgradeImplementation, UpgradeAppliers


class DamageReduc3(UpgradeImplementation):
    id = 'damage_reduc_3'
    name = 'Weakness 3'
    description = '-0.8% damage.'
    rarity = 'rare'
    type = 'stat_modifier'
    cost = 0

    def can_apply(self, state: dict) -> bool:
        return True

    def apply(self, appliers: UpgradeAppliers) -> None:
        value = -0.008
        appliers.modifiers.add_multiplier('attack', 'damage', value)

    def validate(self, recorded_stats: dict) -> bool:
        return True
