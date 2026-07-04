from ..upgrade_implementation import UpgradeImplementation, UpgradeAppliers


class BulletSize2(UpgradeImplementation):
    id = 'bullet_size_2'
    name = 'Heavy Rounds'
    description = '+25% bullet size'
    rarity = 'rare'
    type = 'stat_modifier'
    cost = 10

    def can_apply(self, state: dict) -> bool:
        return True

    def apply(self, appliers: UpgradeAppliers) -> None:
        value = 0.25
        appliers.modifiers.add_multiplier('bullet', 'size', value)

    def validate(self, recorded_stats: dict) -> bool:
        return True
