from ..upgrade_implementation import UpgradeImplementation, UpgradeAppliers


class Fragility2(UpgradeImplementation):
    id = 'fragility_2'
    name = 'Fragility 2'
    description = 'Increased damage taken by 3.5%'
    rarity = 'epic'
    type = 'effect'
    cost = 0

    def can_apply(self, state: dict) -> bool:
        return True

    def apply(self, appliers: UpgradeAppliers) -> None:
        appliers.effects.register_effect('protection', {'value': 0.035})

    def validate(self, recorded_stats: dict) -> bool:
        return True
