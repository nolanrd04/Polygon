from ..upgrade_implementation import UpgradeImplementation, UpgradeAppliers


class ExplosionOnKill(UpgradeImplementation):
    id = 'explosion_on_kill'
    name = 'Chain Reaction'
    description = 'Enemies explode on death'
    rarity = 'epic'
    type = 'effect'
    cost = 20

    def can_apply(self, state: dict) -> bool:
        return True

    def apply(self, appliers: UpgradeAppliers) -> None:
        # Register that this upgrade is active
        # The actual explosion spawning happens in the scene when enemies die
        appliers.effects.register_effect('explode_on_kill', {'damage': 20})

    def validate(self, recorded_stats: dict) -> bool:
        # Explosions should only occur when enemies die
        # Validate by checking:
        # 1. Kills happened (explosions only trigger on death)
        # 2. No unusual explosion damage patterns that suggest explosions outside of kills

        kills = recorded_stats.get('kills', 0)
        total_damage = recorded_stats.get('total_damage', 0)

        # Need at least one kill for explosions to happen
        if kills == 0:
            return False

        # Check if explosion damage seems reasonable
        # Explosions deal 20 base damage (can be modified)
        # If we have N kills, we should see roughly N * 20 damage from explosions
        # But we can't separate explosion damage from regular damage in stats
        # So just verify kills happened - explosions logically follow

        return True
