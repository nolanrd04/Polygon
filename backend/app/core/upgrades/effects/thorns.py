from ..upgrade_implementation import UpgradeImplementation, UpgradeAppliers


class Thorns(UpgradeImplementation):
    id = 'thorns'
    name = 'Thorns'
    description = 'Reflect 10% of damage taken'
    rarity = 'epic'
    type = 'effect'
    cost = 20

    def can_apply(self, state: dict) -> bool:
        return True

    def apply(self, appliers: UpgradeAppliers) -> None:
        appliers.effects.register_effect('thorns', {'amount': 0.1})

    def validate(self, recorded_stats: dict) -> bool:
        return True
