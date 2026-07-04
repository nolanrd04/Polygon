from ..upgrade_implementation import UpgradeImplementation, UpgradeAppliers


class BulletSpeed1(UpgradeImplementation):
    id = 'bullet_speed_1'
    name = 'Velocity Boost'
    description = '+5% bullet speed'
    rarity = 'common'
    type = 'stat_modifier'
    cost = 2

    def can_apply(self, state: dict) -> bool:
        return True

    def apply(self, appliers: UpgradeAppliers) -> None:
        value = 0.05
        appliers.modifiers.add_multiplier('bullet', 'speed', value)

    def validate(self, recorded_stats: dict) -> bool:
        return True
