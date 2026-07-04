from ..upgrade_implementation import UpgradeImplementation, UpgradeAppliers


class Armor(UpgradeImplementation):
    id = 'armor'
    name = 'Hardened Shell'
    description = 'Reduce incoming damage by 2.5%'
    rarity = 'rare'
    type = 'effect'
    cost = 10

    def can_apply(self, state: dict) -> bool:
        return True

    def apply(self, appliers: UpgradeAppliers) -> None:
        appliers.effects.register_effect('protection', {'amount': 0.025})

    def validate(self, recorded_stats: dict) -> bool:
        return True
