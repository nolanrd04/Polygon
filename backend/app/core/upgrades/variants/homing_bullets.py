from ..upgrade_implementation import UpgradeImplementation, UpgradeAppliers


class HomingBullets(UpgradeImplementation):
    id = 'homing_bullets'
    name = 'Homing Bullets'
    description = 'Bullets track nearest enemy with 60% reduced damage.'
    rarity = 'epic'
    type = 'variant'
    cost = 20

    def can_apply(self, state: dict) -> bool:
        # Can't apply if explosive_bullets already active
        applied_upgrades = state.get('applied_upgrades', [])
        return 'explosive_bullets' not in applied_upgrades

    def apply(self, appliers: UpgradeAppliers) -> None:
        appliers.variants.set_active('bullet', 'HomingBullet')
        appliers.modifiers.add_multiplier('bullet', 'damage', -0.60)

    def validate(self, recorded_stats: dict) -> bool:
        expected_damage = recorded_stats.get('expected_damage', 10) * 0.40
        actual_damage = recorded_stats.get('actual_damage', 0)
        return actual_damage >= expected_damage * 0.95
