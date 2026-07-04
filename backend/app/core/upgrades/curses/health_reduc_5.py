from ..upgrade_implementation import UpgradeImplementation, UpgradeAppliers


class HealthReduc5(UpgradeImplementation):
    id = 'health_reduc_5'
    name = 'Reduced Health 5'
    description = '-80 max health.'
    rarity = 'legendary'
    type = 'stat_modifier'
    cost = 0

    def can_apply(self, state: dict) -> bool:
        return True

    def apply(self, appliers: UpgradeAppliers) -> None:
        value = -80
        appliers.modifiers.add_multiplier('player', 'maxHealth', value)

    def validate(self, recorded_stats: dict) -> bool:
        return True
