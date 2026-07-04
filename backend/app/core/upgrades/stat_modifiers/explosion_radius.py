from ..upgrade_implementation import UpgradeImplementation, UpgradeAppliers


class ExplosionRadius(UpgradeImplementation):
    id = 'explosion_radius'
    name = 'Blast Radius'
    description = '+5 explosion radius'
    rarity = 'uncommon'
    type = 'stat_modifier'
    cost = 6

    def can_apply(self, state: dict) -> bool:
        return True

    def apply(self, appliers: UpgradeAppliers) -> None:
        value = 5
        appliers.modifiers.add_multiplier('bullet', 'explosionRadius', value)

    def validate(self, recorded_stats: dict) -> bool:
        return True
