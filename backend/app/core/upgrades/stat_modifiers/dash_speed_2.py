from ..upgrade_implementation import UpgradeImplementation, UpgradeAppliers


class DashSpeed2(UpgradeImplementation):
    id = 'dash_speed_2'
    name = 'Swift Escape'
    description = '+32% dash speed'
    rarity = 'epic'
    type = 'stat_modifier'
    cost = 20

    def can_apply(self, state: dict) -> bool:
        return True

    def apply(self, appliers: UpgradeAppliers) -> None:
        value = 0.32
        appliers.modifiers.add_multiplier('player', 'dashSpeed', value)

    def validate(self, recorded_stats: dict) -> bool:
        return True
