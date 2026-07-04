from ..upgrade_implementation import UpgradeImplementation, UpgradeAppliers


class BulletSize1(UpgradeImplementation):
    id = 'bullet_size_1'
    name = 'Heavy Rounds'
    description = '+10% bullet size'
    rarity = 'uncommon'
    type = 'stat_modifier'
    cost = 6

    def can_apply(self, state: dict) -> bool:
        return True

    def apply(self, appliers: UpgradeAppliers) -> None:
        value = 0.1
        appliers.modifiers.add_multiplier('bullet', 'size', value)

    def validate(self, recorded_stats: dict) -> bool:
        return True
