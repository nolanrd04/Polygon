from ..upgrade_implementation import UpgradeImplementation, UpgradeAppliers


class PlayerHealth5(UpgradeImplementation):
    id = 'player_health_5'
    name = 'Reinforced Core'
    description = '+300 max health'
    rarity = 'legendary'
    type = 'stat_modifier'
    cost = 40

    def can_apply(self, state: dict) -> bool:
        return True

    def apply(self, appliers: UpgradeAppliers) -> None:
        value = 300
        appliers.modifiers.add_multiplier('player', 'maxHealth', value)

    def validate(self, recorded_stats: dict) -> bool:
        return True
