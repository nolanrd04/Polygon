from ..upgrade_implementation import UpgradeImplementation, UpgradeAppliers


class PolygonUpgrade(UpgradeImplementation):
    id = 'polygon_upgrade'
    name = 'Evolution'
    description = '+1 polygon side'
    rarity = 'legendary'
    type = 'stat_modifier'
    cost = 60

    def can_apply(self, state: dict) -> bool:
        return True

    def apply(self, appliers: UpgradeAppliers) -> None:
        value = 1
        appliers.modifiers.add_multiplier('player', 'polygonSides', value)

    def validate(self, recorded_stats: dict) -> bool:
        return True
