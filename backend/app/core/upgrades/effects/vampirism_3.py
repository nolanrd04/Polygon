from ..upgrade_implementation import UpgradeImplementation, UpgradeAppliers


class Vampirism3(UpgradeImplementation):
    id = 'vampirism_3'
    name = 'Vampirism'
    description = 'Heal for 12% of damage dealt'
    rarity = 'legendary'
    type = 'effect'
    cost = 40

    def can_apply(self, state: dict) -> bool:
        return True

    def apply(self, appliers: UpgradeAppliers) -> None:
        appliers.effects.register_effect('lifesteal', {'amount': 0.12})

    def validate(self, recorded_stats: dict) -> bool:
        # Vampirism heals 12% of damage dealt
        damage_dealt = recorded_stats.get('total_damage', 0)
        health_restored = recorded_stats.get('health_restored', 0)
        expected_heal = damage_dealt * 0.12

        # Allow 20% variance
        min_expected = expected_heal * 0.8

        # If significant damage was dealt, healing should have occurred
        if damage_dealt > 100 and health_restored < min_expected:
            return False

        return True
