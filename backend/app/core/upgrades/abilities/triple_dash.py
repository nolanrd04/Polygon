from ..upgrade_implementation import UpgradeImplementation, UpgradeAppliers


class TripleDash(UpgradeImplementation):
    id = 'triple_dash'
    name = 'Triple Dash'
    description = 'Store 3 dashes.'
    rarity = 'legendary'
    type = 'ability'
    cost = 40

    def can_apply(self, state: dict) -> bool:
        return True

    def apply(self, appliers: UpgradeAppliers) -> None:
        appliers.effects.register_effect('triple_dash', {})

    def validate(self, recorded_stats: dict) -> bool:
        return True
