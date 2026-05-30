# Core

The `frontend/src/game/core/` directory contains the shared singletons and constants used across every other part of the game.

---

## GameManager

**File:** `GameManager.ts`  
**Export:** `GameManager` (singleton instance of `GameManagerClass`)

The single source of truth for all runtime game state. Both the Phaser scene (systems, entities) and React components (via `EventBus` events) interact with it.

### State shape

| Field | Type | Description |
|-------|------|-------------|
| `wave` | `number` | Current wave number (starts at 1) |
| `isPaused` | `boolean` | Whether the game is paused |
| `isWaveActive` | `boolean` | Whether a wave is in progress |
| `seed` | `number` | Random seed for the map generator |
| `playerStats` | `PlayerStats` | All player statistics (see below) |
| `appliedUpgrades` | `string[]` | Ordered list of upgrade IDs applied this run |

### PlayerStats fields

| Field | Type | Description |
|-------|------|-------------|
| `health` | `number` | Current HP |
| `maxHealth` | `number` | Maximum HP |
| `speed` | `number` | Movement speed (px/s) |
| `points` | `number` | Currency for buying upgrades |
| `kills` | `number` | Total enemies killed |
| `polygonSides` | `number` | Player polygon sides (3 = triangle, evolves over time) |
| `unlockedAttacks` | `string[]` | Attack types available to the player |
| `isDead` | `boolean` | Permanently set on death; prevents saves and kill tracking after death |

### Key methods

| Method | Description |
|--------|-------------|
| `getState()` | Returns a shallow copy of the full game state |
| `getPlayerStats()` | Returns a shallow copy of player stats |
| `updatePlayerStats(updates)` | Merges partial updates into player stats, emits `player-stats-update` |
| `takeDamage(amount)` | Reduces health, triggers `player-death` on reaching 0 (once per session) |
| `heal(amount)` | Restores health, capped at `maxHealth` |
| `addPoints(points)` | Increments points, emits `player-stats-update` |
| `addKill()` | Increments kill count; blocked after death |
| `applyUpgrade(id, effects)` | Adds upgrade ID to the list and applies simple stat effects |
| `completeWave()` | Marks wave inactive, awards wave bonus points, triggers backend save and pre-loads next wave's upgrades |
| `startWave()` | Marks wave as active |
| `setWave(n)` | Sets the current wave number (called by WaveManager) |
| `pause()` / `resume()` | Toggles pause state, emits `game-pause` / `game-resume` |
| `reset()` | Restores initial state for a fresh game session |
| `getDeathState()` | Returns the frozen `{ wave, kills }` captured at death, or `null` |
| `generateProjectileId()` | Returns a unique auto-incrementing projectile ID |
| `addProjectile(p)` / `removeProjectile(id)` / `getProjectile(id)` / `getAllProjectiles()` | Projectile registry (O(1) Map-based) |

### Death-state freezing

When health reaches 0, `takeDamage()` immediately calls `SaveManager.freezeDeathState()` before emitting `player-death`. This captures the exact wave and kill count at death, preventing in-flight projectile kills from inflating the saved stats. After death, `addKill()` is silently blocked and `completeWave()` skips backend saves.

---

## EventBus

**File:** `EventBus.ts`  
**Export:** `EventBus` (singleton)

A typed publish/subscribe bus used to decouple systems. All event names and their payload types are declared in the `GameEvents` interface.

### Available events

| Event | Payload | Description |
|-------|---------|-------------|
| `wave-start` | `number` | Wave number just started |
| `wave-complete` | `{ wave, score, isPrime }` | Wave just ended |
| `show-upgrades` | — | Request upgrade modal to open |
| `start-next-wave` | — | Player confirmed and wave should begin |
| `player-stats-update` | `PlayerStatsPayload` | Any stat changed |
| `player-death` | — | Player health reached zero |
| `game-pause` / `game-resume` | — | Pause state toggled |
| `upgrade-selected` | `string` (upgradeId) | Player picked an upgrade |
| `upgrade-applied` | `string` (upgradeId) | Upgrade was successfully applied |
| `upgrade-rerolled` | — | Player rerolled the upgrade options |
| `enemy-explode` | `{ x, y, radius, damage }` | Explosion effect requested |
| `enemy-split` | `{ x, y, config, velocityAngle }` | Enemy split on death |
| `enemy-shoot` | `{ x, y, targetX, targetY, damage, speed, color }` | Enemy fired a projectile |
| `thorns-reflect` | `{ damage }` | Thorns damage to reflect |
| `dev-apply-upgrade` | `string` | Dev tool: apply upgrade for free |
| `evolution-milestone` | `number` | Every 6 waves: player polygon evolves |
| `enemy-killed` | `{ type, x, y }` | Enemy died (used by wave validation) |
| `damage-dealt` | `number` | Damage dealt to an enemy (wave validation) |

### API

```ts
EventBus.on(event, callback)   // Subscribe
EventBus.off(event, callback)  // Unsubscribe
EventBus.emit(event, payload)  // Publish
EventBus.removeAllListeners()  // Clear everything (called on game teardown)
```

---

## GameConfig

**File:** `GameConfig.ts`

Exports constants and the Phaser configuration object.

| Export | Value | Description |
|--------|-------|-------------|
| `GAME_WIDTH` | `1280` | Canvas width in pixels |
| `GAME_HEIGHT` | `720` | Canvas height in pixels |
| `WORLD_WIDTH` | `2560` | Scrollable world width (2× canvas) |
| `WORLD_HEIGHT` | `1440` | Scrollable world height (2× canvas) |
| `gameConfig` | `Phaser.Types.Core.GameConfig` | Full Phaser config: `AUTO` renderer, arcade physics (no gravity), `RESIZE` scale mode, `[BootScene, MainScene]` |
| `COLORS` | `Record<string, number>` | Hex color constants for player, enemies, and projectile types |
| `DEV_SETTINGS` | `{ showEnemyHealthBar, showEnemyHealthNumber }` | Getters that read live from `localStorage.gameSettings` |

`Phaser.Scale.RESIZE` is used without `autoCenter` to avoid CSS margin offsets that would desync touch pointer coordinates from game world coordinates.

---

## AudioRegistry

**File:** `AudioRegistry.ts`

Central registry of all audio assets. Provides:

- `AUDIO_REGISTRY` – array of `{ key, path, defaultVolume }` objects for all sound effects:
  - `bullet_shot`, `explosion`, `select_upgrade`, `bullet_tileCollide`
  - `player_hurt`, `enemy_hurt`, `enemy_killed`, `player_dash`, `upgrade_reroll`
- `preloadAllAudio(scene)` – loads all audio files in `BootScene.preload()`.
- `getDefaultVolume(key)` – returns the registered default volume for a key (used when playing sounds so every call site doesn't need to hardcode volume values).
