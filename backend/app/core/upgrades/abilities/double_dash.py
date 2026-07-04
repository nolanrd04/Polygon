from ..upgrade_implementation import UpgradeImplementation, UpgradeAppliers


class DoubleDash(UpgradeImplementation):
    id = 'double_dash'
    name = 'Double Dash'
    description = 'Store 2 dashes.'
    rarity = 'epic'
    type = 'ability'
    cost = 20

    def can_apply(self, state: dict) -> bool:
        return True

    def apply(self, appliers: UpgradeAppliers) -> None:
        appliers.effects.register_effect('double_dash', {})

    def validate(self, recorded_stats: dict) -> bool:
        return True
