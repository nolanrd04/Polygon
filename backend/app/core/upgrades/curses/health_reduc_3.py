from ..upgrade_implementation import UpgradeImplementation, UpgradeAppliers


class HealthReduc3(UpgradeImplementation):
    id = 'health_reduc_3'
    name = 'Reduced Health 3'
    description = '-20 max health.'
    rarity = 'rare'
    type = 'stat_modifier'
    cost = 0

    def can_apply(self, state: dict) -> bool:
        return True

    def apply(self, appliers: UpgradeAppliers) -> None:
        value = -20
        appliers.modifiers.add_multiplier('player', 'maxHealth', value)

    def validate(self, recorded_stats: dict) -> bool:
        return True
