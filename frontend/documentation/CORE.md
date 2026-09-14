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
| `request-ability-state` | — | HUD polls for ability state (every 100 ms from `GamePage`) |
| `ability-state-update` | `{ slots: AbilitySlotState[] }` | `MainScene`'s answer, from `AbilitySystem.getSlots()` |
| `activate-ability` | `string` | Mobile: an ability pad was tapped. `MainScene` calls `AbilitySystem.activate(id)` |
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
| `MOBILE_CAMERA_ZOOM` | `0.6` | Target camera zoom on mobile. Desktop is always `1.0` |
| `MAX_WORLD_VIEW_FRACTION` | `0.92` | Most of the world the camera may show, per axis |
| `resolveCameraZoom(w, h)` | `(number, number) => number` | The zoom for a viewport of `w × h` CSS pixels |

`Phaser.Scale.RESIZE` is used without `autoCenter` to avoid CSS margin offsets that would desync touch pointer coordinates from game world coordinates.

### Mobile camera zoom

Because `RESIZE` sizes the canvas to the viewport, zoom `1.0` shows exactly the device viewport of world: ~1280×720 on a laptop but only ~390×844 on a portrait phone. Same world, a third of the horizontal warning distance — enemies enter frame already on top of the player. `resolveCameraZoom()` pulls the mobile camera back to `MOBILE_CAMERA_ZOOM` to buy that distance back. Nothing else about the layout changes; the touch controls and death text cancel the zoom via [ScreenSpaceLayer](UTILS.md).

`MAX_WORLD_VIEW_FRACTION` is the ceiling, and on a tall phone it binds: at zoom `0.6` an 844px viewport already wants 1407 of the 1440 available world units. Past that the camera's bounds clamp hard — it stops following the player on that axis, the player slides toward the screen edge, and the world's edge sits in frame. So `resolveCameraZoom()` raises the zoom back up as far as the clamp demands, per axis, per viewport. It must be re-run on every resize/orientation change, since a rotate swaps which axis binds; `MainScene.applyCameraZoom()` owns that.

**To zoom out further than this allows, the world itself has to grow** (`WORLD_WIDTH` / `WORLD_HEIGHT`), which also moves enemy spawn rings and map generation — a balance change, not a camera change.

---

## Device

**File:** `Device.ts`

Deliberately import-free (so anything can pull it in without a module cycle), exporting one const:

| Export | Description |
|--------|-------------|
| `IS_MOBILE` | `true` on phones and tablets |

User-agent based, which means **Chrome DevTools device emulation reproduces it exactly** — pick a device preset (not "Responsive", which keeps the desktop UA) and reload. The value is computed once at module load, so toggling device mode on a running page needs a refresh.

`?mobile=1` forces the mobile branch on and `?mobile=0` forces it off. A development affordance: it lets a desktop browser exercise the mobile camera zoom and touch-control layout by just resizing the window. It does **not** fake touch events, so the joysticks stay undraggable with a mouse — use device emulation for those.

`GameConfig`, `MainScene`, `TouchControlManager`, `AbilityDisplay` and `DevTools` all read this const. The remaining React HUD components (`GameHUD`, `UpgradeModal`, `PerfOverlay`) still carry their own copy of the regex; if they ever move onto it, keep the pattern identical so the canvas and DOM overlay never disagree about which layout they are drawing.

---

## TouchLayout

**File:** `TouchLayout.ts`

Geometry of the mobile touch layout, in screen pixels. Import-free, like `Device.ts`.

| Export | Description |
|--------|-------------|
| `TOUCH_LAYOUT` | Joystick radius/padding, pause button size, ability pad size and spacing |
| `abilityPadPosition(index, viewWidth, viewHeight, ceiling, padCount)` | Top-left corner and size of the ability pad at `index` |

**Why it is shared.** The mobile layout spans two rendering layers: the joysticks and pause button are Phaser objects on the canvas (`TouchControlManager`), while the ability pads are DOM buttons (`AbilityDisplay.tsx`) that must land in the slots the on-canvas ability buttons used to occupy — above the joysticks, clear of the pause button. Two copies of these numbers would drift apart the first time one was tuned, so `TouchControlManager`'s private constants read from this object rather than restating it.

Under `Phaser.Scale.RESIZE` the canvas is sized 1:1 with the viewport in CSS pixels, so a screen coordinate means the same thing to both layers. `AbilityDisplay` tracks the viewport with a `resize` / `orientationchange` listener on `window`.

`abilityPadPosition()` keeps the original button layout exactly: pads alternate sides — **even index left, odd right** — and each further pair steps inward from the edge, stacking upward above the joysticks on tall screens (`height > 500`) and spreading outward from beside the pause button on short ones. The `index` is the ability's position among **all** registered bindings, not among the owned ones, so an ability holds the same slot for a whole run instead of sliding about as others are picked up. `padCount` is the total binding count for the same reason — the stack's extent, and therefore how much it must compress, should not change as abilities are acquired.

### Keeping the stack clear of the HUD (`tallStackLayout()`)

On tall screens the stack is anchored to the **joysticks** and grows upward. That is deliberate: it keeps the pads under the thumb on every device, where anchoring to the HUD would float them halfway up an iPad. The cost is that on a short screen the stack climbs into the DOM HUD along the top — the health readout, the wave/points block, and the perf overlay parked under it.

Three stages, cheapest first, each doing only what the one before could not:

| Stage | Does | Binds when |
|-------|------|-----------|
| 1. Compress | Shrinks the gap between pairs to `abilityStackMinGap`. Pair 0 never moves. | There are enough abilities to stack deep |
| 2. Slide | Moves the whole stack down as a unit, keeping the stage-1 spacing, until its top edge clears the ceiling | Short screen |
| 3. Clamp | Stops the slide before pair 0 reaches the joysticks (`abilityStackMinOffset`) | Screens too short for both |

Stage 1 alone is worth only `maxRank × (abilityStackGap − abilityStackMinGap)` pixels, so with three abilities (two rows) it is one row's worth — stage 2 does most of the work on a short screen, where pair 0's *own* top edge is already above the HUD's bottom and there is nothing left to compress.

Under stage 3 the **joysticks win** and the HUD is allowed to overlap: a pad hidden under the FPS readout is still tappable, one under the movement stick is not.

**The ceiling** is supplied by the caller, not computed here: each HUD component reports its own extent, so no one file has to guess at another's Tailwind. `AbilityDisplay` takes the max of `hudBlockBottom()` (GameHUD — health left, wave/points right) and `perfOverlayBottom()` (0 when the FPS readout is off), plus `abilityHudClearance`. One ceiling serves both columns so pairs stay level; the right column normally sets it, since the wave block is taller than the health block and the perf overlay sits below it again.

At ≥844px tall — every current phone in portrait, every tablet — all three stages are inert in every perf mode, and positions are exactly the unclamped `offset + rank * step`.

---

## AudioRegistry

**File:** `AudioRegistry.ts`

Central registry of all audio assets. Provides:

- `AUDIO_REGISTRY` – array of `{ key, path, defaultVolume }` objects for all sound effects:
  - `bullet_shot`, `explosion`, `select_upgrade`, `bullet_tileCollide`
  - `player_hurt`, `enemy_hurt`, `enemy_killed`, `player_dash`, `upgrade_reroll`
- `preloadAllAudio(scene)` – loads all audio files in `BootScene.preload()`.
- `getDefaultVolume(key)` – returns the registered default volume for a key (used when playing sounds so every call site doesn't need to hardcode volume values).
