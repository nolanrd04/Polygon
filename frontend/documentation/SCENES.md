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

1. Pre-generate sprite textures via `TextureGenerator.generateCommonTextures(this)`.
2. Set world and camera bounds (`WORLD_WIDTH × WORLD_HEIGHT = 2560 × 1440`).
3. Create `MapManager` and generate the map.
4. Read `sessionStorage.selectedAttack` and spawn the `Player` at world center.
5. Set the camera to follow the player (`lerp 0.5`, `roundPixels true`), then `applyCameraZoom()` — `1.0` on desktop, pulled back on mobile. Create the `screenUI` layer for scene-owned HUD text.
6. Initialize `EnemyManager`, `WaveManager`, and `CollisionManager`.
7. Register movement keys (WASD/arrows) and call `AbilitySystem.bind(this)` — every ability keybind (SPACE dash, E shield, H heal, …) comes from the upgrade defs, not from this file. See [ABILITY_SYSTEM.md](ABILITY_SYSTEM.md).
8. Subscribe to all `EventBus` events (pause, resume, wave transitions, explosions, upgrades, etc.).
9. Initialize `TouchControlManager` for mobile.
10. After a 500 ms delay:
    - Detect whether this is a new game or a loaded game (checks `points > 0`, `wave > 1`, or existing upgrades).
    - For new games: reset `GameManager`, grant 70 starting points.
    - For loaded games: re-apply saved upgrades via `UpgradeSystem.applyUpgrade()` (with `isRestore = true` to skip cost deduction and sound).
    - **Both branches** then call `UpgradeSystem.grantStartingUpgrades()` and mirror the granted ids into `SaveManager`, so a save written before a `starting: true` ability existed picks it up on load.
    - Pre-load upgrades via `waveValidation.startWave()`.
    - Emit `show-upgrades` to open the `UpgradeModal` before the first wave.

`shutdown` calls `AbilitySystem.unbind()` (dropping its keyboard listeners), removes the `resize` handler, and destroys `screenUI`.

### applyCameraZoom()

Runs on create and on every `resize`. Sets `camera.zoom` from `resolveCameraZoom(scale.width, scale.height)` — see [CORE.md](CORE.md) for why mobile needs it and what caps it — then re-pins both screen-pixel layers (`screenUI`, and the touch controls via `touchControls.syncToCamera()`).

The two sync calls live here rather than in each layer's own `resize` listener so they are guaranteed to run **after** `setZoom`, with no dependence on the order Phaser happens to fire listeners in.

### update(time, delta)

Called once per rendered frame, at the display's refresh rate. It does no game logic itself — it skips if paused (dropping the accumulator so unpausing does not fire a burst), adds `delta` to `logicAccumulator`, clamps it to `FIXED_STEP_MS * MAX_CATCHUP_STEPS`, runs `stepLogic()` for each whole step owed, then writes `PerfStats`.

### stepLogic()

One fixed 1/60 s slice of game logic — see [CORE.md](CORE.md) for why the game does not run off the frame delta:

1. Tick `TouchControlManager`.
2. Increment wave-validation frame counter; sample player state every 30 frames (exactly twice a second now the tick is fixed).
3. Tick `UpgradeSystem.dispatchUpdatePlayer(player, FIXED_STEP_MS)` for regeneration and other time-based effects.
4. Read keyboard input and call `player.move()`. Joystick input takes priority on mobile.
5. On desktop, rotate player toward mouse and shoot if pointer is down.
6. Tick `player.update()` (projectile management, spinner/flame tracking).
7. Tick active `DroppedUpgradeBundle`s and `Particle.UpdateAll(FIXED_STEP_MS)`.
8. Tick `enemyManager.update(playerX, playerY)`.
9. Check `waveManager.isWaveComplete()` and call `waveManager.completeWave()` when true.
10. Draw debug collision boxes if enabled.
11. `LightingSystem.UpdateAll()` — must stay last, and must stay inside the tick: lights are immediate-mode, so a render-rate call would find an empty emitter list on frames that ran no tick.

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
| `request-ability-state` | Emits `ability-state-update` with `AbilitySystem.getSlots()` |
| `activate-ability` | Mobile ability pad tapped → `AbilitySystem.activate(id)` |
| `dev-spawn-enemy` | Spawns the requested enemy type near the player |
| `clear-projectiles` | Calls `player.clearProjectiles()` |
