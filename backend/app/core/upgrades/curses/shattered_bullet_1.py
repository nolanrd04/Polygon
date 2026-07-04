from ..upgrade_implementation import UpgradeImplementation, UpgradeAppliers


class ShatteredBullet1(UpgradeImplementation):
    id = 'shattered_bullet_1'
    name = 'Shattered Bullet 1'
    description = '-1 bullet damage.'
    rarity = 'uncommon'
    type = 'stat_modifier'
    cost = 0

    def can_apply(self, state: dict) -> bool:
        return True

    def apply(self, appliers: UpgradeAppliers) -> None:
        value = -1
        appliers.modifiers.add_multiplier('bullet', 'damage', value)

    def validate(self, recorded_stats: dict) -> bool:
        return True
