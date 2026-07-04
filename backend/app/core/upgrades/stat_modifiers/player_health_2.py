from ..upgrade_implementation import UpgradeImplementation, UpgradeAppliers


class PlayerHealth2(UpgradeImplementation):
    id = 'player_health_2'
    name = 'Reinforced Core'
    description = '+30 max health'
    rarity = 'uncommon'
    type = 'stat_modifier'
    cost = 6

    def can_apply(self, state: dict) -> bool:
        return True

    def apply(self, appliers: UpgradeAppliers) -> None:
        value = 30
        appliers.modifiers.add_multiplier('player', 'maxHealth', value)

    def validate(self, recorded_stats: dict) -> bool:
        return True
