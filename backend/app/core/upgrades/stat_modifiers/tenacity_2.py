from ..upgrade_implementation import UpgradeImplementation, UpgradeAppliers


class Tenacity2(UpgradeImplementation):
    id = 'tenacity_2'
    name = 'Tenacity'
    description = 'Increased the bullet lifespan by .4 seconds'
    rarity = 'epic'
    type = 'stat_modifier'
    cost = 20

    def can_apply(self, state: dict) -> bool:
        return True

    def apply(self, appliers: UpgradeAppliers) -> None:
        value = 400
        appliers.modifiers.add_multiplier('bullet', 'timeLeft', value)

    def validate(self, recorded_stats: dict) -> bool:
        return True
