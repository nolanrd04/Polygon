from ..upgrade_implementation import UpgradeImplementation, UpgradeAppliers


class ShatteredBullet3(UpgradeImplementation):
    id = 'shattered_bullet_3'
    name = 'Shattered Bullet 3'
    description = '-5 bullet damage.'
    rarity = 'epic'
    type = 'stat_modifier'
    cost = 0

    def can_apply(self, state: dict) -> bool:
        return True

    def apply(self, appliers: UpgradeAppliers) -> None:
        value = -5
        appliers.modifiers.add_multiplier('bullet', 'damage', value)

    def validate(self, recorded_stats: dict) -> bool:
        return True
