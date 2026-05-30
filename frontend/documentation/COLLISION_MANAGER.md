# CollisionManager

**File:** `frontend/src/game/systems/CollisionManager.ts`

Registers all Phaser arcade physics collision and overlap callbacks in its constructor. All actual collision handling happens in callback functions — `CollisionManager` is fully event-driven after initialization.

---

## Constructor

```ts
new CollisionManager(scene, player, enemyManager, obstacles?)
```

Immediately calls `setupCollisions()` which registers six physics relationships:

| Pair | Type | Handler |
|------|------|---------|
| Player projectiles ↔ Enemy group | `overlap` | `handleProjectileEnemyCollision` |
| Enemy projectile group ↔ Player | `overlap` | `handleEnemyProjectilePlayerCollision` |
| Player ↔ Enemy group | `overlap` | `handlePlayerEnemyCollision` (damage) |
| Player ↔ Enemy group | `collider` | Default Phaser solid push (prevents passing through) |
| Player projectiles ↔ Obstacles | `collider` | `processProjectileObstacleCollision` / `handleProjectileObstacleCollision` |
| Enemy projectiles ↔ Obstacles | `collider` | Same as above |
| Enemy group ↔ Obstacles | `collider` | `processEnemyObstacleCollision` (bosses pass through) |
| Enemy group ↔ Enemy group | `collider` | Registered in `EnemyManager` — prevents enemy overlap |

---

## Collision handlers

### Player projectile → Enemy

`handleProjectileEnemyCollision(projectileContainer, enemyContainer)`

1. Extracts the `Projectile` and `Enemy` instances from the container data store.
2. Checks `projectile._canHitEnemy(enemy.id)` — skips if the hit cooldown hasn't elapsed.
3. Calls `UpgradeEffectSystem.onProjectileHit(projectile, enemy)` to trigger effects (e.g. lifesteal).
4. Calls `projectile.OnHitNPC(enemy)` — if it returns `false`, damage is suppressed (used by `ExplosiveBullet`).
5. If damage is applied: runs through `UpgradeModifierSystem` for final damage value, calls `enemy.takeDamage()`, emits `damage-dealt`.
6. If the enemy dies: calls `GameManager.addKill()`, awards points via `GameManager.addPoints()` (probabilistic based on `enemy.scoreChance`), calls `UpgradeEffectSystem.onEnemyKill(enemy)`.
7. Calls `projectile._recordHit(enemy.id)` — increments pierce count; destroys if exhausted.
8. Applies knockback to the enemy if `projectile.knockback > 0` (also run through `UpgradeModifierSystem`).

### Enemy projectile → Player

`handleEnemyProjectilePlayerCollision(projectileContainer, _player)`

1. Extracts the `Projectile` from the container.
2. Checks per-projectile cooldown via `lastProjectileDamageByProjectileId` map (`hitEnemyCooldown` ms).
3. Calls `player.takeDamage(Math.ceil(projectile.damage))`.
4. Calls `projectile._recordHit(0)` (player is treated as enemy ID 0 for pierce tracking).
5. Pushes the player away at 150 px/s along the collision angle.

### Player ↔ Enemy (melee)

`handlePlayerEnemyCollision(_player, enemyContainer)`

1. Checks `enemy.lastHitPlayerTime` — 500 ms per-enemy cooldown to prevent rapid ticking.
2. Calls `player.takeDamage(Math.ceil(enemy.damage))`.
3. If the thorns effect is active, calls `enemy.takeDamage(damageAmount × thornsValue)`.
4. Pushes the player away at 200 px/s.

### Projectile ↔ Obstacle (processCallback)

`processProjectileObstacleCollision(projectileContainer, obstacle)`

Returns `false` (don't block) in all cases — actual destruction happens inside this function:

1. Calls `projectile.OnObstacleCollide(obstacle)`.
2. If `canCutTiles`: increments pierce count; destroys if exhausted. Returns `false`.
3. If ricochet effect is active and owner is `'player'`: calls `projectile.ricochet(obstacle)`. Returns `false`.
4. Otherwise: calls `projectile._destroy()`. Returns `false`.

### Enemy ↔ Obstacle (processCallback)

`processEnemyObstacleCollision(enemyContainer, _obstacle)`

- Boss enemies (`isBoss = true`): returns `false` — pass through without collision.
- Regular enemies: returns `true` — normal Phaser solid collision applies.

---

## Fields

| Field | Description |
|-------|-------------|
| `playerDamageCooldown` | 500 ms per-enemy melee damage cooldown |
| `lastProjectileDamageByProjectileId` | `Map<number, number>` — tracks last hit time per projectile ID to implement `hitEnemyCooldown` |
