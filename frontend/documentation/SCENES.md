# Scenes

Phaser scenes live in `frontend/src/game/scenes/`. The game runs exactly two scenes, one after the other.

---

## BootScene

**File:** `BootScene.ts`  
**Key:** `'BootScene'`

The first scene to run. Its sole job is asset preloading.

**`preload()`**
- Renders a loading bar and progress box using Phaser `Graphics`.
- Calls `preloadAllAudio(this)` from `AudioRegistry` to queue all sound files for loading.
- Hooks `load.on('progress')` to animate the fill bar.
- Hooks `load.on('complete')` to clean up the loading UI.

**`create()`**
- Immediately starts `MainScene`.

No game logic runs in `BootScene`. Polygon textures are not loaded from files — they are generated at runtime by `TextureGenerator` inside `MainScene.create()`.

---

## MainScene

**File:** `MainScene.ts`  
**Key:** `'MainScene'`

The main game loop scene. All gameplay happens here.

### create()

Initialization order matters:

1. Register effect handlers via `registerEffectHandlers()`.
2. Pre-generate sprite textures via `TextureGenerator.generateCommonTextures(this)`.
3. Set world and camera bounds (`WORLD_WIDTH × WORLD_HEIGHT = 2560 × 1440`).
4. Create `MapManager` and generate the map.
5. Read `sessionStorage.selectedAttack` and spawn the `Player` at world center.
6. Set the camera to follow the player (`lerp 0.5`, `roundPixels true`, `zoom 1.0`).
7. Initialize `EnemyManager`, `WaveManager`, and `CollisionManager`.
8. Register keyboard shortcuts: WASD/arrows for movement, SPACE for dash, E for shield.
9. Subscribe to all `EventBus` events (pause, resume, wave transitions, explosions, upgrades, etc.).
10. Initialize `TouchControlManager` for mobile.
11. After a 500 ms delay:
    - Detect whether this is a new game or a loaded game (checks `points > 0`, `wave > 1`, or existing upgrades).
    - For new games: reset `GameManager`, grant 70 starting points.
    - For loaded games: re-apply saved upgrades via `UpgradeSystem.applyUpgrade()` (with `isRestore = true` to skip cost deduction and sound).
    - Pre-load upgrades via `waveValidation.startWave()`.
    - Emit `show-upgrades` to open the `UpgradeModal` before the first wave.

### update(time, delta)

Called every frame (≈16 ms at 60 fps):

1. Skip if paused.
2. Tick `TouchControlManager`.
3. Increment wave-validation frame counter; sample player state every 30 frames.
4. Tick `UpgradeEffectSystem.onUpdate(delta)` for regeneration and other time-based effects.
5. Read keyboard input and call `player.move()`. Joystick input takes priority on mobile.
6. On desktop, rotate player toward mouse and shoot if pointer is down.
7. Tick `player.update()` (projectile management, spinner/flame tracking).
8. Tick `enemyManager.update(playerX, playerY)`.
9. Check `waveManager.isWaveComplete()` and call `waveManager.completeWave()` when true.
10. Draw debug collision boxes if enabled.

### spawnProjectile(projectile, sx, sy, tx, ty, owner, ownerId)

Centralized factory used by both `Player` and enemy classes. Assigns a unique ID, calls `projectile._spawn()`, registers with `GameManager`, and adds the container to the correct Phaser group for collision detection.

### applyUpgrade(upgradeId, skipCost?, isRestore?)

Looks up the upgrade definition from the merged JSON arrays, verifies the player can afford it, calls `UpgradeSystem.applyUpgrade()`, syncs points with the backend via `waveValidation.selectUpgrade()`, and applies direct player-stat effects (max health, speed, polygon sides). The `isRestore` flag suppresses cost deduction, sound, and backend sync when re-applying upgrades from a loaded save.

### EventBus subscriptions (in create)

| Event | Handler |
|-------|---------|
| `game-pause` / `game-resume` | Pauses/resumes the Phaser scene |
| `start-next-wave` | Resets `upgradeMenuOpen`, calls `waveManager.startNextWave()` |
| `upgrade-selected` | Calls `applyUpgrade()` |
| `upgrade-rerolled` | Plays reroll sound |
| `dev-apply-upgrade` | Calls `applyUpgrade(id, true)` |
| `dev-remove-upgrade` | Calls `UpgradeSystem.decrementUpgrade()` |
| `evolution-milestone` | Applies `polygon_upgrade` for free |
| `toggle-collision-boxes` | Toggles debug rendering |
| `set-wave` | Clears enemies and jumps to a specific wave |
| `enemy-explode` | Draws explosion graphic and emits `explosion-damage` |
| `player-death` | Renders "YOU DIED" text fixed to screen |
| `enemy-split` | Spawns child enemies at the split position |
| `enemy-killed` | Records death for wave validation |
| `damage-dealt` | Records damage for wave validation |
| `request-ability-state` | Reads ability state from Player and emits `ability-state-update` |
| `dev-spawn-enemy` | Spawns the requested enemy type near the player |
| `clear-projectiles` | Calls `player.clearProjectiles()` |
