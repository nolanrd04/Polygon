from ..upgrade_implementation import UpgradeImplementation, UpgradeAppliers


class DashCooldown2(UpgradeImplementation):
    id = 'dash_cooldown_2'
    name = 'Swift Recovery'
    description = '-15% dash cooldown'
    rarity = 'epic'
    type = 'stat_modifier'
    cost = 20

    def can_apply(self, state: dict) -> bool:
        return True

    def apply(self, appliers: UpgradeAppliers) -> None:
        value = -0.15
        appliers.modifiers.add_multiplier('player', 'dashCooldown', value)

    def validate(self, recorded_stats: dict) -> bool:
        return True
