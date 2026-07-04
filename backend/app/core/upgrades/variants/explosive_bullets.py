from ..upgrade_implementation import UpgradeImplementation, UpgradeAppliers


class ExplosiveBullets(UpgradeImplementation):
    id = 'explosive_bullets'
    name = 'Explosive Bullets'
    description = 'Bullets explode on impact dealing collision and area damage.'
    rarity = 'epic'
    type = 'variant'
    cost = 20

    def can_apply(self, state: dict) -> bool:
        applied_upgrades = state.get('applied_upgrades', [])
        return True

    def apply(self, appliers: UpgradeAppliers) -> None:
        appliers.variants.set_active('bullet', 'ExplosiveBullet')

    def validate(self, recorded_stats: dict) -> bool:
        return True
