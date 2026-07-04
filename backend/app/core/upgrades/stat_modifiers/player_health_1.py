from ..upgrade_implementation import UpgradeImplementation, UpgradeAppliers


class PlayerHealth1(UpgradeImplementation):
    id = 'player_health_1'
    name = 'Reinforced Core'
    description = '+10 max health'
    rarity = 'common'
    type = 'stat_modifier'
    cost = 2

    def can_apply(self, state: dict) -> bool:
        return True

    def apply(self, appliers: UpgradeAppliers) -> None:
        value = 10
        appliers.modifiers.add_multiplier('player', 'maxHealth', value)

    def validate(self, recorded_stats: dict) -> bool:
        return True
