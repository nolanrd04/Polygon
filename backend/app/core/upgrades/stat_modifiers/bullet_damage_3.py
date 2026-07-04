from ..upgrade_implementation import UpgradeImplementation, UpgradeAppliers


class BulletDamage3(UpgradeImplementation):
    id = 'bullet_damage_3'
    name = 'Sharper Rounds'
    description = '+8 bullet damage'
    rarity = 'rare'
    type = 'stat_modifier'
    cost = 10

    def can_apply(self, state: dict) -> bool:
        return True

    def apply(self, appliers: UpgradeAppliers) -> None:
        value = 8
        appliers.modifiers.add_multiplier('attack', 'damage', value)

    def validate(self, recorded_stats: dict) -> bool:
        return True
