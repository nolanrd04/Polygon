from ..upgrade_implementation import UpgradeImplementation, UpgradeAppliers


class BulletDamage4(UpgradeImplementation):
    id = 'bullet_damage_4'
    name = 'Sharper Rounds'
    description = '+16 bullet damage'
    rarity = 'epic'
    type = 'stat_modifier'
    cost = 20

    def can_apply(self, state: dict) -> bool:
        return True

    def apply(self, appliers: UpgradeAppliers) -> None:
        value = 16
        appliers.modifiers.add_multiplier('attack', 'damage', value)

    def validate(self, recorded_stats: dict) -> bool:
        return True
