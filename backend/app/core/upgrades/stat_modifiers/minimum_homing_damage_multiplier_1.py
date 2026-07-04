from ..upgrade_implementation import UpgradeImplementation, UpgradeAppliers


class MinimumHomingDamageMultiplier1(UpgradeImplementation):
    id = 'minimum_homing_damage_multiplier_1'
    name = 'Kinetic Amplifier'
    description = 'Increases the possible damage of homing bullets by 2%'
    rarity = 'epic'
    type = 'stat_modifier'
    cost = 20

    def can_apply(self, state: dict) -> bool:
        return True

    def apply(self, appliers: UpgradeAppliers) -> None:
        value = 0.02
        appliers.modifiers.add_multiplier('bullet', 'minimumDamageMultiplier', value)

    def validate(self, recorded_stats: dict) -> bool:
        return True
