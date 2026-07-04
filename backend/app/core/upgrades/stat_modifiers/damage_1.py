from ..upgrade_implementation import UpgradeImplementation, UpgradeAppliers


class Damage1(UpgradeImplementation):
    id = 'damage_1'
    name = 'Devastation'
    description = '+0.2% damage.'
    rarity = 'common'
    type = 'stat_modifier'
    cost = 2

    def can_apply(self, state: dict) -> bool:
        return True

    def apply(self, appliers: UpgradeAppliers) -> None:
        appliers.modifiers.add_multiplier('attack', 'damage', 0.002)

    def validate(self, recorded_stats: dict) -> bool:
        min_expected = 10 * 1.002
        damage_per_shot = recorded_stats.get('damage_per_shot', 0)
        return damage_per_shot >= min_expected * 0.95
