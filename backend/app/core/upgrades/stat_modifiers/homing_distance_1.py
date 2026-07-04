from ..upgrade_implementation import UpgradeImplementation, UpgradeAppliers


class HomingDistance1(UpgradeImplementation):
    id = 'homing_distance_1'
    name = 'Enhanced Eyesight'
    description = '+20 tracking distance for homing bullets'
    rarity = 'uncommon'
    type = 'stat_modifier'
    cost = 6

    def can_apply(self, state: dict) -> bool:
        return True

    def apply(self, appliers: UpgradeAppliers) -> None:
        value = 20
        appliers.modifiers.add_multiplier('bullet', 'trackingDistance', value)

    def validate(self, recorded_stats: dict) -> bool:
        return True
