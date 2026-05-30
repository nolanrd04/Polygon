# Upgrade Bundle Implementation Steps

1. **Create `frontend/src/game/systems/difficulty/DifficultyManager.ts`**
   - Implement singleton class with private `current: Difficulty` property
   - Export singleton instance: `DifficultyManager = new DifficultyManagerClass()`
   - Methods: `getCurrent(): Difficulty`, `setCurrent(d: Difficulty): void`
   - Initialize with `current = NormalDifficulty`

2. **Modify `frontend/src/game/services/WaveValidation.ts`**
   - Remove `import { NormalDifficulty } from './Normal'`
   - Add `import { DifficultyManager } from './systems/difficulty/DifficultyManager'`
   - Replace `NormalDifficulty.getRarityWeights(...)` calls with `DifficultyManager.getCurrent().getRarityWeights(...)` at lines 107 and 474

3. **Modify `frontend/src/game/core/GameManager.ts`**
   - Extract initial player stats into exported constant `BASE_PLAYER_STATS` with shape: `{ health: 100, maxHealth: 100, speed: 200, points: 0, kills: 0, polygonSides: 3 }`
   - Replace inline object literal for `state.playerStats` with `BASE_PLAYER_STATS`

4. **Create `frontend/src/game/data/upgrades/curse_upgrades.json`**
   - Define 8 curse entries matching `UpgradeDefinition` shape + `isCurse: true`
   - **Damage curses** (`target: "attack"`, `stat: "damage"`): `curse_damage_1` (-1, common), `curse_damage_2` (-3, uncommon), `curse_damage_3` (-5, rare), `curse_damage_4` (-10, epic)
   - **Health curses** (`target: "player"`, `stat: "maxHealth"`): `curse_health_1` (-5, common), `curse_health_2` (-10, uncommon), `curse_health_3` (-20, rare), `curse_health_4` (-40, epic)
   - Omit `cost` field for all entries

5. **Modify `frontend/src/game/systems/upgrades/UpgradeModifierSystem.ts`**
   - Import `BASE_PLAYER_STATS` from `GameManager`
   - In `applyModifiers(target, stat, baseValue)`, after computing raw result:
     ```
     if (target === 'attack' && stat === 'damage') {
       return Math.max(baseValue, raw)
     }
     ```

6. **Create `frontend/src/game/entities/upgrades/DroppedUpgradeBundle.ts`**
   - Define interfaces: `CurseDefinition extends UpgradeDefinition { isCurse: true }`, `BundleContents { upgrades: UpgradeDefinition[], curses: CurseDefinition[] }`
   - Implement static `generateContents(waveNumber: number): BundleContents`:
     - Call `DifficultyManager.getCurrent().getRarityWeights(waveNumber)`
     - `totalItems = Phaser.Math.Between(1, 4)`
     - `includeCurses = Math.random() < 0.5`
     - `curseCount = includeCurses ? Phaser.Math.Between(1, Math.min(2, totalItems)) : 0`
     - `upgradeCount = totalItems - curseCount`
     - For each slot: weighted rarity roll → random pick from appropriate pool
   - Implement `computeHighestRarity(contents): Rarity` using index lookup
   - Constructor `(scene, x, y, waveNumber)`:
     - Generate contents, compute highest rarity
     - Create graphics with inner fill (70% opacity) and outer ring (40% opacity)
     - Create container with graphics, add physics with static body (circle radius 20)
     - Set container data `bundleInstance = this`
     - Add pulsing tween (scale 1.25, yoyo, infinite, Sine.easeInOut, 700ms)
   - Implement `getContainer()`, `getContents()`, `destroy()` (tween to scale 0, destroy container, set `isDestroyed = true`)

7. **Create `frontend/src/game/systems/DroppedBundleManager.ts`**
   - Class with `scene`, `bundles: DroppedUpgradeBundle[]`, `group: StaticGroup`
   - Constructor: `group = scene.physics.add.staticGroup()`
   - `spawnBundle(x, y, waveNumber)`: create bundle, add container to group, push to bundles array
   - `getGroup()`: return group
   - `destroyBundle(bundle)`: tween to scale 0/alpha 0 over 150ms, on complete: `group.remove(container, true, true)`, `bundle.destroy()`, filter from bundles array
   - `clearAll()`: loop destroy each bundle, `group.clear(true, true)`, clear array
   - `update()`: filter bundles by `!isDestroyed`

8. **Modify `frontend/src/game/systems/CollisionManager.ts`**
   - Constructor: add optional 5th parameter `bundleManager?: DroppedBundleManager`, store as `private bundleManager`
   - In `setupCollisions()`: after existing overlap handlers, add:
     ```
     if (this.bundleManager) {
       this.scene.physics.add.overlap(
         this.player,
         this.bundleManager.getGroup(),
         this.handlePlayerBundleCollision
       )
     }
     ```
   - Add `handlePlayerBundleCollision(_player, bundleContainer)`:
     - Get container, extract bundle via `getData('bundleInstance')`
     - If bundle valid, call `bundleManager.destroyBundle(bundle)`
     - Emit `EventBus.emit('bundle-picked-up', contents)`
   - In `handleProjectileEnemyCollision()`: after `GameManager.addKill()` and before `UpgradeEffectSystem.onEnemyKill()`:
     ```
     if (Math.random() < enemy.scoreChance * 0.5) {
       EventBus.emit('spawn-bundle', { x: enemy.x, y: enemy.y })
     }
     ```

9. **Modify `frontend/src/game/scenes/MainScene.ts`**
   - Add members: `bundleManager!: DroppedBundleManager`, `pendingBundleIds: string[] = []`
   - In `create()`:
     - Instantiate `this.bundleManager = new DroppedBundleManager(this)` before `CollisionManager`
     - Pass `bundleManager` to `CollisionManager` constructor as 5th arg
     - Add `EventBus.on('spawn-bundle', ...)` to spawn bundle at specified coordinates with current wave
     - Add `EventBus.on('bundle-picked-up', ...)` to call `applyBundleContents` and play sound
     - Add `EventBus.on('wave-complete', ...)` to flush pending IDs to `appliedUpgrades`, call `SaveManager.recordUpgradePurchase` for each, clear pending IDs, call `bundleManager.clearAll()`
   - In `update()`: add `this.bundleManager.update()` before `this.enemyManager.update()`
   - Add `private async applyBundleContents(contents: BundleContents)`:
     - For each upgrade: `await this.applyUpgrade(id, true, false, true)`, push ID to `pendingBundleIds`
     - For each curse: `this.applyCurse(curse)`, push ID to `pendingBundleIds`
     - Call `waveValidation.recordBundlePickup(upgradeIds, curseIds)`
   - Modify `applyUpgrade()` signature: add 4th param `isTemporary: boolean = false`
     - When `true`: skip pushing to `appliedUpgrades`, skip `SaveManager.recordUpgradePurchase`, skip `waveValidation.selectUpgrade()`
   - Add `private applyCurse(curse: CurseDefinition)`:
     - If `target === 'player'` && `stat === 'maxHealth'`: compute new max with floor `BASE_PLAYER_STATS.maxHealth`, update stats via `GameManager.updatePlayerStats()`, also clamp current health to new max
     - If `target === 'attack'` && `stat === 'damage'`: call `UpgradeModifierSystem.addModifier('attack', 'damage', curse.value, false)`

10. **Create `frontend/src/components/BundlePickupNotification.tsx`**
    - Define `NotificationEntry` interface with `id`, `items: Array<{ name, rarity, isCurse }> `
    - Define `RARITY_COLORS` object with hex values for all rarities plus curse red
    - State: `notifications: NotificationEntry[]`
    - Effect: on mount subscribe to `'bundle-picked-up'` event; on event: create entry, setState, schedule removal after 3s, unsubscribe on unmount
    - Render container: `position: fixed`, `top: clamp(60px, 8vh, 90px)`, `left: 50%`, `transform: translateX(-50%)`, `zIndex: 9999`, `pointerEvents: none`
    - Per-notification card:
      - Header "Bundle Opened!"
      - Item list: name + rarity (colored text by rarity, red for curses)
      - Border/outline with rarity color
    - Mobile detection: `/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)`
    - Mobile styles: `fontSize: '11px'`, `padding: '6px 10px'`, `maxWidth: 'min(280px, 80vw)'`
    - Enter animation: CSS `@keyframes slideDown` (translateY -10px → 0, opacity 0 → 1, 200ms)

11. **Modify `frontend/src/components/GamePage.tsx` (or HUD mounting location)**
    - Import `BundlePickupNotification`
    - Inside game overlay div, add `<BundlePickupNotification />` alongside `<GameHUD />`

12. **Create/Modify `frontend/src/game/data/upgrades/curse_upgrades.json`** (if using TypeScript instead of JSON)
    - Define types inline: `export interface CurseDefinition extends UpgradeDefinition { isCurse: true }`
    - Export array of curse objects with IDs, names, descriptions, rarities, targets, stats, negative values

13. **Modify `backend/app/core/upgrade_data.py`**
    - Add `CURSE_DATA` dict with same shape as `UPGRADE_DATA` for all 8 curse entries
    - Add `ALL_VALID_CURSE_IDS: set[str] = set(CURSE_DATA.keys())`
    - Export both new constants

14. **Modify `backend/app/services/wave_service.py`**
    - In `complete_wave()`, after existing validation, add:
      ```python
      for bundle in payload.get('bundle_pickups', []):
          for uid in bundle.get('upgrade_ids', []):
              if uid not in ALL_VALID_UPGRADE_IDS:
                  await flag_wave(token, reason="invalid_bundle_upgrade_id", detail=uid, severity="high")
          for cid in bundle.get('curse_ids', []):
              if cid not in ALL_VALID_CURSE_IDS:
                  await flag_wave(token, reason="invalid_curse_id", detail=cid, severity="high")
      ```

15. **Modify `frontend/src/game/services/WaveValidation.ts`** (Phase 2 backend integration)
    - Add `private pendingBundlePickups: Array<{ upgradeIds: string[]; curseIds: string[] }> = []`
    - Add `recordBundlePickup(upgradeIds: string[], curseIds: string[])`:
      - Check `if (!localStorage.getItem('token')) return` (no-op offline)
      - Push to `pendingBundlePickups`
    - In `startWave()`: reset `this.pendingBundlePickups = []`
    - In `completeWave()` payload: add `bundle_pickups: this.pendingBundlePickups`
