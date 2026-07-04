from ..upgrade_implementation import UpgradeImplementation, UpgradeAppliers


class ExplosionDamage2(UpgradeImplementation):
    id = 'explosion_damage_2'
    name = 'Volatile Core'
    description = '+11 explosion damage'
    rarity = 'epic'
    type = 'stat_modifier'
    cost = 20

    def can_apply(self, state: dict) -> bool:
        return True

    def apply(self, appliers: UpgradeAppliers) -> None:
        value = 11
        appliers.modifiers.add_multiplier('bullet', 'explosionDamage', value)

    def validate(self, recorded_stats: dict) -> bool:
        return True
