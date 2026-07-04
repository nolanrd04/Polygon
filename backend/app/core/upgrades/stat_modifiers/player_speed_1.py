from ..upgrade_implementation import UpgradeImplementation, UpgradeAppliers


class PlayerSpeed1(UpgradeImplementation):
    id = 'player_speed_1'
    name = 'Thruster Boost'
    description = '+10 movement speed'
    rarity = 'uncommon'
    type = 'stat_modifier'
    cost = 6

    def can_apply(self, state: dict) -> bool:
        return True

    def apply(self, appliers: UpgradeAppliers) -> None:
        value = 10
        appliers.modifiers.add_multiplier('player', 'speed', value)

    def validate(self, recorded_stats: dict) -> bool:
        return True
