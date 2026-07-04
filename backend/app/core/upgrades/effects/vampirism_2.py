from ..upgrade_implementation import UpgradeImplementation, UpgradeAppliers


class Vampirism2(UpgradeImplementation):
    id = 'vampirism_2'
    name = 'Vampirism'
    description = 'Heal for 5% of damage dealt'
    rarity = 'epic'
    type = 'effect'
    cost = 20

    def can_apply(self, state: dict) -> bool:
        return True

    def apply(self, appliers: UpgradeAppliers) -> None:
        appliers.effects.register_effect('lifesteal', {'amount': 0.05})

    def validate(self, recorded_stats: dict) -> bool:
        # Vampirism heals 5% of damage dealt
        damage_dealt = recorded_stats.get('total_damage', 0)
        health_restored = recorded_stats.get('health_restored', 0)
        expected_heal = damage_dealt * 0.05

        # Allow 20% variance
        min_expected = expected_heal * 0.8

        # If significant damage was dealt, healing should have occurred
        if damage_dealt > 100 and health_restored < min_expected:
            return False

        return True
