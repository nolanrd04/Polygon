from ..upgrade_implementation import UpgradeImplementation, UpgradeAppliers


class MinimumHomingDamageMultiplier2(UpgradeImplementation):
    id = 'minimum_homing_damage_multiplier_2'
    name = 'Kinetic Amplifier'
    description = 'Increases the possible damage of homing bullets by 5%'
    rarity = 'legendary'
    type = 'stat_modifier'
    cost = 40

    def can_apply(self, state: dict) -> bool:
        return True

    def apply(self, appliers: UpgradeAppliers) -> None:
        value = 0.05
        appliers.modifiers.add_multiplier('bullet', 'minimumDamageMultiplier', value)

    def validate(self, recorded_stats: dict) -> bool:
        return True
