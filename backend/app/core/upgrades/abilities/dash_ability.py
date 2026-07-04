from ..upgrade_implementation import UpgradeImplementation, UpgradeAppliers


class DashAbility(UpgradeImplementation):
    id = 'dash_ability'
    name = 'Dash'
    description = 'Press SPACE to dash'
    rarity = 'rare'
    type = 'ability'
    cost = 10

    def can_apply(self, state: dict) -> bool:
        return True

    def apply(self, appliers: UpgradeAppliers) -> None:
        appliers.effects.register_effect('dash', {})

    def validate(self, recorded_stats: dict) -> bool:
        return True
