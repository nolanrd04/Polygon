from ..upgrade_implementation import UpgradeImplementation, UpgradeAppliers


class ExplosionDamage3(UpgradeImplementation):
    id = 'explosion_damage_3'
    name = 'Volatile Core'
    description = '+25 explosion damage'
    rarity = 'legendary'
    type = 'stat_modifier'
    cost = 40

    def can_apply(self, state: dict) -> bool:
        return True

    def apply(self, appliers: UpgradeAppliers) -> None:
        value = 25
        appliers.modifiers.add_multiplier('bullet', 'explosionDamage', value)

    def validate(self, recorded_stats: dict) -> bool:
        return True
