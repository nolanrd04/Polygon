from ..upgrade_implementation import UpgradeImplementation, UpgradeAppliers


class Ricochet(UpgradeImplementation):
    id = 'ricochet'
    name = 'Ricochet Rounds'
    description = 'Projectiles bounce off surfaces.'
    rarity = 'epic'
    type = 'effect'
    cost = 20

    def can_apply(self, state: dict) -> bool:
        return True

    def apply(self, appliers: UpgradeAppliers) -> None:
        appliers.effects.register_effect('ricochet', {'amount': 1})

    def validate(self, recorded_stats: dict) -> bool:
        return True
