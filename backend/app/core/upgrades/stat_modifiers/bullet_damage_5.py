from ..upgrade_implementation import UpgradeImplementation, UpgradeAppliers


class BulletDamage5(UpgradeImplementation):
    id = 'bullet_damage_5'
    name = 'Sharper Rounds'
    description = '+35 bullet damage'
    rarity = 'legendary'
    type = 'stat_modifier'
    cost = 40

    def can_apply(self, state: dict) -> bool:
        return True

    def apply(self, appliers: UpgradeAppliers) -> None:
        value = 35
        appliers.modifiers.add_multiplier('attack', 'damage', value)

    def validate(self, recorded_stats: dict) -> bool:
        return True
