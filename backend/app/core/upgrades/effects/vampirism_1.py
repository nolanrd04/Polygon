from ..upgrade_implementation import UpgradeImplementation, UpgradeAppliers


class Vampirism1(UpgradeImplementation):
    id = 'vampirism_1'
    name = 'Vampirism'
    description = 'Heal for 2% of damage dealt'
    rarity = 'rare'
    type = 'effect'
    cost = 10

    def can_apply(self, state: dict) -> bool:
        return True

    def apply(self, appliers: UpgradeAppliers) -> None:
        appliers.effects.register_effect('lifesteal', {'amount': 0.02})

    def validate(self, recorded_stats: dict) -> bool:
        # Vampirism heals 2% of damage dealt
        damage_dealt = recorded_stats.get('total_damage', 0)
        health_restored = recorded_stats.get('health_restored', 0)
        expected_heal = damage_dealt * 0.02

        # Allow 20% variance
        min_expected = expected_heal * 0.8

        # If significant damage was dealt, healing should have occurred
        if damage_dealt > 100 and health_restored < min_expected:
            return False

        return True
