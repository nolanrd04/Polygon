from ..upgrade_implementation import UpgradeImplementation, UpgradeAppliers


class HealthReduc1(UpgradeImplementation):
    id = 'health_reduc_1'
    name = 'Reduced Health 1'
    description = '-5 max health.'
    rarity = 'common'
    type = 'stat_modifier'
    cost = 0

    def can_apply(self, state: dict) -> bool:
        return True

    def apply(self, appliers: UpgradeAppliers) -> None:
        value = -5
        appliers.modifiers.add_multiplier('player', 'maxHealth', value)

    def validate(self, recorded_stats: dict) -> bool:
        return True
