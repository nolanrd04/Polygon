from ..upgrade_implementation import UpgradeImplementation, UpgradeAppliers


class Armor2(UpgradeImplementation):
    id = 'armor_2'
    name = 'Hardened Shell'
    description = 'Reduce incoming damage by 6%'
    rarity = 'epic'
    type = 'effect'
    cost = 20

    def can_apply(self, state: dict) -> bool:
        return True

    def apply(self, appliers: UpgradeAppliers) -> None:
        appliers.effects.register_effect('protection', {'amount': 0.06})

    def validate(self, recorded_stats: dict) -> bool:
        return True
