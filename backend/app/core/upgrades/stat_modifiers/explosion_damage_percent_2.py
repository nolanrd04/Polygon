from ..upgrade_implementation import UpgradeImplementation, UpgradeAppliers


class ExplosionDamagePercent2(UpgradeImplementation):
    id = 'explosion_damage_percent_2'
    name = 'Explosive Force'
    description = '+7% explosion damage'
    rarity = 'legendary'
    type = 'stat_modifier'
    cost = 40

    def can_apply(self, state: dict) -> bool:
        return True

    def apply(self, appliers: UpgradeAppliers) -> None:
        value = 0.07
        appliers.modifiers.add_multiplier('bullet', 'explosionDamage', value)

    def validate(self, recorded_stats: dict) -> bool:
        return True
