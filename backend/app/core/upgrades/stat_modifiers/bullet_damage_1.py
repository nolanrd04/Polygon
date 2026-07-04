from ..upgrade_implementation import UpgradeImplementation, UpgradeAppliers


class BulletDamage1(UpgradeImplementation):
    id = 'bullet_damage_1'
    name = 'Sharper Rounds'
    description = '+1 bullet damage'
    rarity = 'common'
    type = 'stat_modifier'
    cost = 2

    def can_apply(self, state: dict) -> bool:
        return True

    def apply(self, appliers: UpgradeAppliers) -> None:
        value = 1
        appliers.modifiers.add_multiplier('attack', 'damage', value)

    def validate(self, recorded_stats: dict) -> bool:
        return True
