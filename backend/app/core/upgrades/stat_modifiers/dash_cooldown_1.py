from ..upgrade_implementation import UpgradeImplementation, UpgradeAppliers


class DashCooldown1(UpgradeImplementation):
    id = 'dash_cooldown_1'
    name = 'Swift Recovery'
    description = '-5% dash cooldown'
    rarity = 'rare'
    type = 'stat_modifier'
    cost = 10

    def can_apply(self, state: dict) -> bool:
        return True

    def apply(self, appliers: UpgradeAppliers) -> None:
        value = -0.05
        appliers.modifiers.add_multiplier('player', 'dashCooldown', value)

    def validate(self, recorded_stats: dict) -> bool:
        return True
