# EnemyManager

**File:** `frontend/src/game/systems/EnemyManager.ts`

Owns the full lifecycle of all enemies in the scene: spawning, updating, scaling, and removal. Also manages enemy-fired projectiles.

---

## Constructor

```ts
new EnemyManager(scene)
```

Creates two Phaser groups: `enemyGroup` (for collision with player/projectiles) and `enemyProjectileGroup`. Registers an enemy-to-enemy `collider` so enemies push each other apart instead of overlapping.

---

## Enemy spawning

### `spawnEnemy(typeId, x?, y?, dropScore = true, dropBundle = true, configure?)`

1. Looks up `typeId` in `EnemyRegistry` (from `entities/enemies/index.ts`).
2. If no position given, picks a random point on one of the four world edges.
3. Instantiates the enemy, calls `SetDefaults()`.
4. `dropScore` / `dropBundle` control death drops for enemies spawned as sub-spawns (e.g. Octogon splitting into Squares, SuperOctogon's minions) so they don't award extra score/bundles on top of the parent's:
   - `dropScore = false` zeroes `scoreChance`.
   - `dropBundle = false` sets `canDropBundle = false`, which makes `DropBundles()` a no-op regardless of `bundleDropChance`. (`bundleDropChance` itself is a chance override — `0` means "use the difficulty's default chance", not "never drop"; `canDropBundle` is the actual on/off switch.)
   - `dropScore = false, dropBundle = true` carries the enemy's original `scoreChance` over to `bundleDropChance`, so a no-score sub-spawn can still roll for a bundle at that rate.
5. Applies wave scaling:
   - `health *= waveMultiplier`
   - `damage *= waveMultiplier`
   - `speed *= getSpeedMultiplier(wave, enemy.speedCap)`
6. Special case: reduces Diamond enemy dash cooldown (`waitFrames`) at waves 10/15/20.
7. Runs the optional `configure` hook (after scaling, before the enemy is built) so a spawner can derive stats from its own already-scaled values.
8. Calls `enemy._spawn(scene, x, y, id)`.
9. Adds to `enemies[]` and `enemyGroup`.

### `scaleEnemyStats(wave)`

Sets `waveMultiplier = Math.exp(wave / 8)`.

At wave 1 (wave-0 input): multiplier ≈ 1.0.  
At wave 8: multiplier ≈ 2.7.  
At wave 16: multiplier ≈ 7.4.

### `getSpeedMultiplier(wave, speedCap)`

Returns `min(speedCap, 1 + wave × 0.1)` — speed increases by 10% per wave, capped per enemy type.

---

## Update

### `update(playerX, playerY)`

Called every frame by `MainScene`.

- Iterates enemies in reverse order; removes destroyed ones.
- Calls `enemy._update(playerX, playerY)` for living enemies.
- Iterates enemy projectiles; removes out-of-bounds or destroyed ones; calls `proj._update()`.

---

## Enemy projectile management

### `addProjectile(projectile, container)`

Called by enemy ability handlers (via `ShootAbility`) when an enemy fires. Adds to `projectiles[]` and `enemyProjectileGroup`.

### `getEnemyProjectileGroup()`

Returns the Phaser group used by `CollisionManager` for player-projectile overlap registration.

---

## Queries

| Method | Description |
|--------|-------------|
| `getEnemies()` | Returns all non-destroyed enemies |
| `getGroup()` | Returns `enemyGroup` (Phaser group) |
| `getActiveCount()` | Count of non-destroyed enemies (used by `WaveManager.isWaveComplete()`) |
| `getWaveMultiplier()` | Current scaling multiplier |
| `getProjectiles()` | All active enemy projectiles |

## Cleanup

### `clear()`

Destroys all enemies and enemy projectiles. Called by `MainScene` when the dev tool jumps to a specific wave.
