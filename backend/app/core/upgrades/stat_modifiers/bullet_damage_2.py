from ..upgrade_implementation import UpgradeImplementation, UpgradeAppliers


class BulletDamage2(UpgradeImplementation):
    id = 'bullet_damage_2'
    name = 'Sharper Rounds'
    description = '+4 bullet damage'
    rarity = 'uncommon'
    type = 'stat_modifier'
    cost = 6

    def can_apply(self, state: dict) -> bool:
        return True

    def apply(self, appliers: UpgradeAppliers) -> None:
        value = 4
        appliers.modifiers.add_multiplier('attack', 'damage', value)

    def validate(self, recorded_stats: dict) -> bool:
        return True
