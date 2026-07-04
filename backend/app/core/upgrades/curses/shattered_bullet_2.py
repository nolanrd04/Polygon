from ..upgrade_implementation import UpgradeImplementation, UpgradeAppliers


class ShatteredBullet2(UpgradeImplementation):
    id = 'shattered_bullet_2'
    name = 'Shattered Bullet 2'
    description = '-3 bullet damage.'
    rarity = 'rare'
    type = 'stat_modifier'
    cost = 0

    def can_apply(self, state: dict) -> bool:
        return True

    def apply(self, appliers: UpgradeAppliers) -> None:
        value = -3
        appliers.modifiers.add_multiplier('bullet', 'damage', value)

    def validate(self, recorded_stats: dict) -> bool:
        return True
