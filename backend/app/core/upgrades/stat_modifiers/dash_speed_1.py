from ..upgrade_implementation import UpgradeImplementation, UpgradeAppliers


class DashSpeed1(UpgradeImplementation):
    id = 'dash_speed_1'
    name = 'Swift Escape'
    description = '+15% dash speed'
    rarity = 'rare'
    type = 'stat_modifier'
    cost = 10

    def can_apply(self, state: dict) -> bool:
        return True

    def apply(self, appliers: UpgradeAppliers) -> None:
        value = 0.15
        appliers.modifiers.add_multiplier('player', 'dashSpeed', value)

    def validate(self, recorded_stats: dict) -> bool:
        return True
