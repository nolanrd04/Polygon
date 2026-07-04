from ..upgrade_implementation import UpgradeImplementation, UpgradeAppliers


class HomingDistance2(UpgradeImplementation):
    id = 'homing_distance_2'
    name = 'Enhanced Eyesight'
    description = '+50 tracking distance for homing bullets'
    rarity = 'rare'
    type = 'stat_modifier'
    cost = 10

    def can_apply(self, state: dict) -> bool:
        return True

    def apply(self, appliers: UpgradeAppliers) -> None:
        value = 50
        appliers.modifiers.add_multiplier('bullet', 'trackingDistance', value)

    def validate(self, recorded_stats: dict) -> bool:
        return True
