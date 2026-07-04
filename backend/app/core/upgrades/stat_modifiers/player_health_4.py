from ..upgrade_implementation import UpgradeImplementation, UpgradeAppliers


class PlayerHealth4(UpgradeImplementation):
    id = 'player_health_4'
    name = 'Reinforced Core'
    description = '+130 max health'
    rarity = 'epic'
    type = 'stat_modifier'
    cost = 20

    def can_apply(self, state: dict) -> bool:
        return True

    def apply(self, appliers: UpgradeAppliers) -> None:
        value = 130
        appliers.modifiers.add_multiplier('player', 'maxHealth', value)

    def validate(self, recorded_stats: dict) -> bool:
        return True
