from ..upgrade_implementation import UpgradeImplementation, UpgradeAppliers


class PlayerHealth3(UpgradeImplementation):
    id = 'player_health_3'
    name = 'Reinforced Core'
    description = '+60 max health'
    rarity = 'rare'
    type = 'stat_modifier'
    cost = 10

    def can_apply(self, state: dict) -> bool:
        return True

    def apply(self, appliers: UpgradeAppliers) -> None:
        value = 60
        appliers.modifiers.add_multiplier('player', 'maxHealth', value)

    def validate(self, recorded_stats: dict) -> bool:
        return True
