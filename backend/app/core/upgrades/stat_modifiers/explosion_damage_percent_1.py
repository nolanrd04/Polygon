from ..upgrade_implementation import UpgradeImplementation, UpgradeAppliers


class ExplosionDamagePercent1(UpgradeImplementation):
    id = 'explosion_damage_percent_1'
    name = 'Explosive Force'
    description = '+3% explosion damage'
    rarity = 'epic'
    type = 'stat_modifier'
    cost = 20

    def can_apply(self, state: dict) -> bool:
        return True

    def apply(self, appliers: UpgradeAppliers) -> None:
        value = 0.03
        appliers.modifiers.add_multiplier('bullet', 'explosionDamage', value)

    def validate(self, recorded_stats: dict) -> bool:
        return True
