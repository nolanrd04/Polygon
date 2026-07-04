from ..upgrade_implementation import UpgradeImplementation, UpgradeAppliers


class Tenacity1(UpgradeImplementation):
    id = 'tenacity_1'
    name = 'Tenacity'
    description = 'Increased the bullet lifespan by .15 seconds'
    rarity = 'rare'
    type = 'stat_modifier'
    cost = 10

    def can_apply(self, state: dict) -> bool:
        return True

    def apply(self, appliers: UpgradeAppliers) -> None:
        value = 150
        appliers.modifiers.add_multiplier('bullet', 'timeLeft', value)

    def validate(self, recorded_stats: dict) -> bool:
        return True
