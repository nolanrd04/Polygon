from ..upgrade_implementation import UpgradeImplementation, UpgradeAppliers


class Regeneration(UpgradeImplementation):
    id = 'regeneration'
    name = 'Auto Repair'
    description = 'Regenerate 1 HP/sec'
    rarity = 'epic'
    type = 'effect'
    cost = 20

    def can_apply(self, state: dict) -> bool:
        return True

    def apply(self, appliers: UpgradeAppliers) -> None:
        appliers.effects.register_effect('regen', {'amount': 1})

    def validate(self, recorded_stats: dict) -> bool:
        health_recovered = recorded_stats.get('health_recovered', 0)
        return health_recovered > 5
