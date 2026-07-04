from ..upgrade_implementation import UpgradeImplementation, UpgradeAppliers


class ShieldAbility(UpgradeImplementation):
    id = 'shield_ability'
    name = 'Energy Shield'
    description = 'Press E for temporary shield (consumable, stacks)'
    rarity = 'rare'
    type = 'effect'
    cost = 10

    def can_apply(self, state: dict) -> bool:
        return True

    def apply(self, appliers: UpgradeAppliers) -> None:
        appliers.effects.register_effect('shield', {})

    def validate(self, recorded_stats: dict) -> bool:
        return True
