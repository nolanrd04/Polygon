from ..upgrade_implementation import UpgradeImplementation, UpgradeAppliers


class HealthReduc2(UpgradeImplementation):
    id = 'health_reduc_2'
    name = 'Reduced Health 2'
    description = '-10 max health.'
    rarity = 'uncommon'
    type = 'stat_modifier'
    cost = 0

    def can_apply(self, state: dict) -> bool:
        return True

    def apply(self, appliers: UpgradeAppliers) -> None:
        value = -10
        appliers.modifiers.add_multiplier('player', 'maxHealth', value)

    def validate(self, recorded_stats: dict) -> bool:
        return True
