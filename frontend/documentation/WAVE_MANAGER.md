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

Called by `MainScene` when the player starts a new wave (via the `start-next-wave` EventBus event), which ends the [intermission](#intermission). Everything up to `GameManager.startWave()` runs synchronously, so `isWaveActive` is already `true` when the call returns; `GamePage.handleStartWave` relies on that to ignore a second press.

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

The game is now in the intermission.

---

## Intermission

The phase between waves (and before the first wave of a session) where the player roams the field. There is no separate flag: it is exactly `!GameManager.getState().isWaveActive`. It ends only when the player starts the next wave. There is no auto-start timer.

### Entering

| When | Signal | Emitted by |
|---|---|---|
| Session start (new or loaded game) | `intermission-start` | `MainScene` create, after `waveValidation.startWave()` has loaded the token |
| A wave completes | `wave-complete` | `GameManager.completeWave()`, after it pre-loads the next token |

Both signals fire only once the next wave's token is loaded, so nothing can start a wave without one. `GamePage` sets its `intermission` state on either. The wave-complete screen comes first; its **Continue** drops the player on the field. The shop never opens on its own.

### What runs and what doesn't

| Allowed | Frozen |
|---|---|
| Movement | Player buff ticks (`player._updateBuffs`) |
| Shooting (shots are not recorded, see below) | `UpgradeSystem.dispatchUpdatePlayer` (regeneration and other per-tick upgrade hooks) |
| Picking up bundles | Ability use and cooldowns (`AbilitySystem.setFrozen`, [ABILITY_SYSTEM.md](ABILITY_SYSTEM.md#intermission-freeze)) |
| Shop, rerolls | Bundle expiry (`DroppedUpgradeBundle._update(false)`; they still animate) |

`MainScene.stepLogic` works these out from `betweenWaves` once per tick. Buffs from a bundle picked up now are still held until the wave starts ([BUFFS.md](BUFFS.md#bundle-drops)), because the server's `queued` window starts at `wave_start_frame`.

**Shooting.** `WaveValidation.recordShotFired` ignores shots while `waveStartFrame` is `null` (the token is loaded but the wave hasn't started). The `start-next-wave` handler calls `player.clearProjectiles()`, so an unrecorded bullet can never land a hit in the wave. Fire-rate validation and run accuracy analytics only see wave shots.

**Movement samples.** `stepLogic` keeps sampling through the intermission, and the server checks those intervals like any other. `WaveValidation.markWaveStart` then drops all but the last intermission sample. `sampleFrame` caps the list at 200 and halves it on overflow, so a long intermission would otherwise thin the wave's own samples and loosen the movement check. The kept sample anchors the first in-wave interval, so the step into the wave is still speed-checked.

**Wave duration.** The server times the wave from `wave_start_frame`, not from token issue, so the intermission doesn't count in run analytics (`wave_duration_seconds`, see `backend/documentation/RUN_ANALYTICS.md`). It does count toward lifetime playtime.

### Controls

| | Start wave | Shop |
|---|---|---|
| Desktop | `IntermissionBar` **Start Wave** button or **Enter** | `IntermissionBar` **Shop** button or **Tab** (toggles) |
| Mobile | **Play** button left of pause (`TouchControlManager`) | **Shop** in the pause menu |
| Both | **Start Wave** inside the shop | **Close** in the shop returns to the field |

Every start path ends in `GamePage.handleStartWave`, which returns early if a wave is already active, then emits `start-next-wave`. The mobile Play button emits `request-start-wave` rather than `start-next-wave`, so it goes through the same check.

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
