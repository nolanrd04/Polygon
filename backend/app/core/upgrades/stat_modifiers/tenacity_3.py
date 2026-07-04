from ..upgrade_implementation import UpgradeImplementation, UpgradeAppliers


class Tenacity3(UpgradeImplementation):
    id = 'tenacity_3'
    name = 'Tenacity'
    description = 'Increased the bullet lifespan by 1 second'
    rarity = 'legendary'
    type = 'stat_modifier'
    cost = 40

    def can_apply(self, state: dict) -> bool:
        return True

    def apply(self, appliers: UpgradeAppliers) -> None:
        value = 1000
        appliers.modifiers.add_multiplier('bullet', 'timeLeft', value)

    def validate(self, recorded_stats: dict) -> bool:
        return True
