from ..upgrade_implementation import UpgradeImplementation, UpgradeAppliers


class ExplosionDamage1(UpgradeImplementation):
    id = 'explosion_damage_1'
    name = 'Volatile Core'
    description = '+5 explosion damage'
    rarity = 'rare'
    type = 'stat_modifier'
    cost = 10

    def can_apply(self, state: dict) -> bool:
        return True

    def apply(self, appliers: UpgradeAppliers) -> None:
        value = 5
        appliers.modifiers.add_multiplier('bullet', 'explosionDamage', value)

    def validate(self, recorded_stats: dict) -> bool:
        return True
