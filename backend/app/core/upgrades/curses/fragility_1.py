from ..upgrade_implementation import UpgradeImplementation, UpgradeAppliers


class Fragility1(UpgradeImplementation):
    id = 'fragility_1'
    name = 'Fragility 1'
    description = 'Increased damage taken by 1.25%'
    rarity = 'rare'
    type = 'effect'
    cost = 0

    def can_apply(self, state: dict) -> bool:
        return True

    def apply(self, appliers: UpgradeAppliers) -> None:
        appliers.effects.register_effect('protection', {'value': 0.0125})

    def validate(self, recorded_stats: dict) -> bool:
        return True
