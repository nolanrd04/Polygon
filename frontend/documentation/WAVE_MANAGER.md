# WaveManager

**File:** `frontend/src/game/systems/WaveManager.ts`

Controls the flow of waves: starting them, spawning enemies, and completing them. Delegates all difficulty-specific values to a `Difficulty` implementation.

---

## Constructor

```ts
new WaveManager(scene, enemyManager, difficulty?)
```

Defaults to `NormalDifficulty` if no difficulty is provided.

---

## Wave lifecycle

### `startNextWave()`

Called by `MainScene` when the player starts a new wave (via the `start-next-wave` EventBus event).

1. Sets `waveActive = true`.
2. Calls `GameManager.setWave(currentWave)`.
3. Calls `enemyManager.scaleEnemyStats(currentWave - 1)` to apply wave multipliers.
4. Checks `difficulty.getScheduledBossSpawns(currentWave)`:
   - If boss spawns exist: calls `startBossWave()`.
   - Otherwise: calls `startNormalWave()`.
5. Calls `GameManager.startWave()` and emits `wave-start`.

### `startNormalWave()`

Reads enemy count from `difficulty.getEnemyCount(wave)` and calls `spawnEnemiesGradually()`.

### `startBossWave(bossSpawns)`

Halves the normal enemy count (`× 0.5`), then:
- Calls `spawnEnemiesGradually()` for the regular pool.
- After a 2-second delay, calls `enemyManager.spawnEnemy(typeId)` for each boss in `bossSpawns`.

### `spawnEnemiesGradually()`

Creates a repeating Phaser timer event at `difficulty.getSpawnDelay(wave)` ms intervals. Each tick:
1. Checks if all enemies have been spawned.
2. Calls `selectWeightedRandom(difficulty.getSpawnWeights(wave))` to pick an enemy type.
3. Calls `enemyManager.spawnEnemy(typeId)`.
4. Destroys the timer once all enemies are spawned.

### `selectWeightedRandom(weights)`

Picks an enemy type from the weighted list using a uniform random number. Weights do not need to sum to any specific value.

### `isWaveComplete()`

Returns `true` when all enemies have been spawned AND `enemyManager.getActiveCount() === 0`.

Checked every frame in `MainScene.update()`.

### `completeWave()`

Called by `MainScene` when `isWaveComplete()` returns `true`.

1. Sets `waveActive = false`.
2. Calls `waveValidation.completeWave(currentWave)` for backend validation.
3. Emits `clear-projectiles` to destroy all in-flight projectiles.
4. If `currentWave % 6 === 0`: emits `evolution-milestone` for polygon evolution.
5. Calls `GameManager.completeWave()` (awards wave bonus points, triggers save, pre-loads next upgrades).
6. Increments `currentWave`.
7. Calls `GameManager.setWave(currentWave)`.
8. Saves the incremented wave to backend (if player is alive).

---

## Queries

| Method | Description |
|--------|-------------|
| `getCurrentWave()` | Returns `currentWave` |
| `isWaveActive()` | Whether a wave is currently running |
| `isBossWave()` | Whether the current wave has scheduled boss spawns |
| `isPrimeWave()` | Whether `currentWave` is a prime number (informational) |
| `setWave(n)` | Jumps to a specific wave (used by dev tools). Resets spawn counters. |

---

## Boss schedule (Normal difficulty)

Waves 10, 20, and 30 spawn: three Hexagons + one Dodecahedron alongside the halved regular enemy pool.
