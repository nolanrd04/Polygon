from ..upgrade_implementation import UpgradeImplementation, UpgradeAppliers


class BulletPierce1(UpgradeImplementation):
    id = 'bullet_pierce_1'
    name = 'Piercing Shot'
    description = 'Bullets pierce +1 enemy'
    rarity = 'rare'
    type = 'stat_modifier'
    cost = 10

    def can_apply(self, state: dict) -> bool:
        return True

    def apply(self, appliers: UpgradeAppliers) -> None:
        value = 1
        appliers.modifiers.add_multiplier('bullet', 'pierce', value)

    def validate(self, recorded_stats: dict) -> bool:
        return True
