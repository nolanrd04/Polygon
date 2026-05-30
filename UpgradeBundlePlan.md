# Plan: Dropped Upgrade Bundle System

## Context

The game currently awards upgrades only between waves via a weighted roll-and-select UI. This plan adds mid-wave **Dropped Upgrade Bundles** — stationary entities dropped by enemies on death that the player walks over to collect. Bundles contain 1–4 upgrades (and potentially 1–2 "curses") rolled using the current wave's rarity weights. This introduces mid-wave risk/reward decisions and a new category of negative modifiers ("curses") that mirror stat upgrades but reduce player power.

Three key design invariants:
1. **No mid-wave persistence** — Bundle contents are applied to game systems immediately on pickup so the player feels the effects, but are only committed to `appliedUpgrades`/`SaveManager`/backend at wave end. This mirrors how points, health, and kills are tracked mid-wave without being saved until wave completion.
2. **Difficulty-agnostic** — All rarity weight lookups use `DifficultyManager.getCurrent()` instead of importing `NormalDifficulty` directly, so adding new difficulties later doesn't require touching the bundle system.
3. **Stat floors** — Curses enforce minimums equal to the base player stats defined in `GameManager.ts`'s initial state.

Implementation is **Phase 1 = frontend/offline only**. Phase 2 adds backend online validation.

---

## Architecture Overview

```
Enemy dies
  └─ CollisionManager emits 'spawn-bundle' (probability = scoreChance × 0.5)
       └─ MainScene → DroppedBundleManager.spawnBundle(x, y, wave)
            └─ DroppedUpgradeBundle: rolls contents via DifficultyManager, creates Phaser container

Player walks over bundle
  └─ CollisionManager player-vs-bundle overlap fires
       └─ bundle destroyed; emits 'bundle-picked-up' { upgrades[], curses[] }
            ├─ MainScene.applyBundleContents()
            │    ├─ applyUpgrade(id, skipCost=true, isRestore=false, isTemporary=true)  [effects live immediately]
            │    └─ applyCurse(curse, isTemporary=true)                                 [effects live immediately]
            │         both push IDs into this.pendingBundleIds[]
            └─ BundlePickupNotification.tsx shows what was received

Wave ends (wave-complete event)
  └─ MainScene flushes pendingBundleIds → appliedUpgrades[] + SaveManager.recordUpgradePurchase()
  └─ waveValidation.recordBundlePickup() tracked; submitted in completeWave() payload
  └─ pendingBundleIds cleared
```

---

## Relevant Codebase Context

### Key files and their roles
- `frontend/src/game/core/GameManager.ts` — singleton game state; initial `playerStats` defines base stat values (health: 100, maxHealth: 100, speed: 200)
- `frontend/src/game/scenes/MainScene.ts` — owns all managers; `applyUpgrade(id, skipCost, isRestore)` is the main upgrade application method
- `frontend/src/game/systems/CollisionManager.ts` — all physics overlaps; `handleProjectileEnemyCollision` is where enemy kill logic lives (line 128). Enemy `scoreChance` (0.3–1.0) controls point drop probability.
- `frontend/src/game/systems/upgrades/UpgradeSystem.ts` — routes upgrade application by type (stat_modifier, effect, variant, visual_effect, ability)
- `frontend/src/game/systems/upgrades/UpgradeModifierSystem.ts` — additive + multiplicative stat modifiers; `applyModifiers(target, stat, baseValue)` computes final value
- `frontend/src/game/systems/upgrades/UpgradeEffectSystem.ts` — triggered effects (lifesteal, regen, armor, etc.)
- `frontend/src/game/services/WaveValidation.ts` — mid-wave tracking; currently imports `NormalDifficulty` directly (lines 7, 107, 474)
- `frontend/src/game/systems/difficulty/Difficulty.ts` — `Difficulty` interface with `getRarityWeights(wave): RarityWeights` already defined
- `frontend/src/game/systems/difficulty/Normal.ts` — `NormalDifficulty` object implementing the interface
- `frontend/src/game/systems/WaveManager.ts` — already uses constructor DI for difficulty (`difficulty: Difficulty = NormalDifficulty`)
- `frontend/src/game/data/upgrades/stat_upgrades.json` — 42 stat modifier upgrades; includes `bullet_damage_1–5` (+1/+4/+8/+16/+35) and health upgrades
- `frontend/src/components/GameHUD.tsx` — HUD; mobile detection via userAgent regex; scales via `transform: scale(0.5)` on mobile
- `frontend/src/game/core/EventBus.ts` — shared event bus; pattern: `EventBus.emit('event-name', data)` / `EventBus.on('event-name', handler)`
- `frontend/src/game/entities/upgrades/DroppedUpgradeBundle.ts` — **currently empty**; this is the file to implement
- `backend/app/services/wave_service.py` — wave completion validation; validates upgrade IDs, damage, kills
- `backend/app/core/upgrade_data.py` — backend source of truth for all valid upgrade IDs

### UpgradeDefinition shape (from stat_upgrades.json)
```typescript
interface UpgradeDefinition {
  id: string
  name: string
  description: string
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'
  type: 'stat_modifier' | 'variant' | 'effect' | 'visual_effect' | 'ability'
  target?: string       // 'player', 'attack', 'bullet', etc.
  stat?: string         // 'damage', 'maxHealth', 'speed', etc.
  value?: number
  isMultiplier?: boolean
  stackable: boolean
  maxStacks?: number
  cost?: number
}
```

### Enemy scoreChance values (from Enemy subclasses)
- Triangle: 0.3 → bundle drop chance: 15%
- Square: 0.4 → 20%
- Diamond: 0.45 → 22.5%
- Hexagon: 0.65 → 32.5%
- Dodecahedron (boss): 1.0 → 50%

### Existing rarity color scheme (from UpgradeModal.tsx)
```
common:    gray   (border-gray-500)
uncommon:  green  (border-green-500)
rare:      blue   (border-blue-500)
epic:      purple (border-purple-500)
legendary: yellow (border-yellow-500)
```
Phaser hex equivalents: `0x888888 / 0x22c55e / 0x3b82f6 / 0xa855f7 / 0xeab308`

---

## Phase 0: DifficultyManager (prerequisite)

### New file: `frontend/src/game/systems/difficulty/DifficultyManager.ts`

Simple singleton holding the currently active `Difficulty` instance. All systems that need rarity weights call through this instead of importing a specific difficulty.

```typescript
import { NormalDifficulty } from './Normal'
import type { Difficulty } from './Difficulty'

class DifficultyManagerClass {
  private current: Difficulty = NormalDifficulty

  getCurrent(): Difficulty { return this.current }
  setCurrent(d: Difficulty): void { this.current = d }
}

export const DifficultyManager = new DifficultyManagerClass()
```

### Modified file: `frontend/src/game/services/WaveValidation.ts`

Replace the two direct `NormalDifficulty.getRarityWeights(...)` calls (lines 107 and 474) with `DifficultyManager.getCurrent().getRarityWeights(...)`. Remove the `NormalDifficulty` import; import `DifficultyManager` instead.

`WaveManager` already uses constructor-param DI with `NormalDifficulty` as default — leave it unchanged; its pattern is already correct.

---

## Phase 1: Stat Minimums & Curse Data Layer

### Modified file: `frontend/src/game/core/GameManager.ts`

Extract the initial player stats object into an exported constant:

```typescript
export const BASE_PLAYER_STATS = {
  health: 100,
  maxHealth: 100,
  speed: 200,
  points: 0,
  kills: 0,
  polygonSides: 3,
} as const
```

Use this constant to initialise `GameManagerClass.state.playerStats` (replace the inline object literal).

**Curse stat minimums derived from this:**
- `player/maxHealth` floor: `BASE_PLAYER_STATS.maxHealth` = **100** — curses can reduce max health only as far as the un-upgraded baseline
- `attack/damage` additive modifier floor: **base weapon value** — in `applyModifiers()`, clamp result to `Math.max(baseValue, raw)` so curses can cancel upgrade gains but can't make damage worse than the weapon's native base damage

### New file: `frontend/src/game/data/upgrades/curse_upgrades.json`

Curses use the same shape as `UpgradeDefinition` plus `"isCurse": true`. No `cost` field (never purchased, only found in bundles).

**Damage curses** (`target: "attack"`, `stat: "damage"`, `isMultiplier: false`):
| ID | Name | Rarity | Value |
|---|---|---|---|
| `curse_damage_1` | Blunted Rounds | common | -1 |
| `curse_damage_2` | Dull Rounds | uncommon | -3 |
| `curse_damage_3` | Weakened Arsenal | rare | -5 |
| `curse_damage_4` | Feeble Arsenal | epic | -10 |

**Health curses** (`target: "player"`, `stat: "maxHealth"`, `isMultiplier: false`):
| ID | Name | Rarity | Value |
|---|---|---|---|
| `curse_health_1` | Frailty | common | -5 |
| `curse_health_2` | Vulnerability | uncommon | -10 |
| `curse_health_3` | Fragility | rare | -20 |
| `curse_health_4` | Glass Bones | epic | -40 |

### Modified file: `frontend/src/game/systems/upgrades/UpgradeModifierSystem.ts`

Import `BASE_PLAYER_STATS` from `GameManager.ts`. In `applyModifiers(target, stat, baseValue)`, after computing the raw result, clamp for attack damage:

```typescript
applyModifiers(target: string, stat: string, baseValue: number): number {
  const additive = this.getAdditiveModifier(target, stat)
  const multiplicative = this.getMultiplicativeModifier(target, stat)
  const raw = (baseValue + additive) * (1 + multiplicative)
  // Damage can never go below the weapon's own base via modifiers
  if (target === 'attack' && stat === 'damage') {
    return Math.max(baseValue, raw)
  }
  return raw
}
```

`maxHealth` floor is enforced in `applyCurse()` in MainScene (it's a direct player stat, not a modifier).

---

## Phase 2: DroppedUpgradeBundle Entity

### New file: `frontend/src/game/entities/upgrades/DroppedUpgradeBundle.ts`

Standalone Phaser entity class (does NOT extend Enemy or Projectile).

**Export:**
```typescript
export interface CurseDefinition extends UpgradeDefinition {
  isCurse: true
}

export interface BundleContents {
  upgrades: UpgradeDefinition[]
  curses: CurseDefinition[]
}
```

**Static `generateContents(waveNumber: number): BundleContents`**:
1. `const weights = DifficultyManager.getCurrent().getRarityWeights(waveNumber)`
2. `const totalItems = Phaser.Math.Between(1, 4)`
3. `const includeCurses = Math.random() < 0.5`
4. `const curseCount = includeCurses ? Phaser.Math.Between(1, Math.min(2, totalItems)) : 0`
5. `const upgradeCount = totalItems - curseCount`
6. For each upgrade slot: weighted rarity roll → random pick from combined stat/effect/variant/visual/ability upgrade pool for that rarity
7. For each curse slot: weighted rarity roll → random pick from `curse_upgrades.json` for that rarity
8. Return `{ upgrades, curses }`

Rarity roll helper (same algorithm as `WaveValidation.ts`):
```typescript
function rollRarity(weights: RarityWeights): Rarity {
  const r = Math.random()
  let cumulative = 0
  for (const [rarity, weight] of Object.entries(weights)) {
    cumulative += weight
    if (r < cumulative) return rarity as Rarity
  }
  return 'common'
}
```

**`highestRarity`**: iterate all items in contents, return highest rarity by index: `['common','uncommon','rare','epic','legendary']`.

**Constructor `(scene, x, y, waveNumber)`**:
1. `this.contents = DroppedUpgradeBundle.generateContents(waveNumber)`
2. `this.highestRarity = computeHighestRarity(this.contents)`
3. Create `graphics = scene.add.graphics()`
   - Inner fill: `graphics.fillStyle(RARITY_COLORS[this.highestRarity], 0.7); graphics.fillCircle(0, 0, 14)`
   - Outer ring: `graphics.lineStyle(2, RARITY_COLORS[this.highestRarity], 0.4); graphics.strokeCircle(0, 0, 20)`
4. `this.container = scene.add.container(x, y, [graphics])`
5. `scene.physics.add.existing(this.container, true)` — static body; `(this.container.body as Phaser.Physics.Arcade.StaticBody).setCircle(20)`
6. `this.container.setData('bundleInstance', this)`
7. Pulse tween: `scene.tweens.add({ targets: this.container, scaleX: 1.25, scaleY: 1.25, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })`

**Methods**: `getContainer()`, `getContents(): BundleContents`, `isDestroyed: boolean = false`, `destroy()` (stop tweens, `this.container.destroy()`, set `isDestroyed = true`)

---

## Phase 3: DroppedBundleManager

### New file: `frontend/src/game/systems/DroppedBundleManager.ts`

```typescript
export class DroppedBundleManager {
  private scene: Phaser.Scene
  private bundles: DroppedUpgradeBundle[] = []
  private group: Phaser.Physics.Arcade.StaticGroup

  constructor(scene: Phaser.Scene) {
    this.group = scene.physics.add.staticGroup()
  }

  spawnBundle(x: number, y: number, waveNumber: number): void {
    const bundle = new DroppedUpgradeBundle(this.scene, x, y, waveNumber)
    this.group.add(bundle.getContainer())
    this.bundles.push(bundle)
  }

  getGroup(): Phaser.Physics.Arcade.StaticGroup { return this.group }

  destroyBundle(bundle: DroppedUpgradeBundle): void {
    // Pop tween, then destroy
    this.scene.tweens.add({
      targets: bundle.getContainer(),
      scaleX: 0, scaleY: 0, alpha: 0,
      duration: 150,
      onComplete: () => {
        this.group.remove(bundle.getContainer(), true, true)
        bundle.destroy()
      }
    })
    this.bundles = this.bundles.filter(b => b !== bundle)
  }

  clearAll(): void {
    for (const b of this.bundles) b.destroy()
    this.group.clear(true, true)
    this.bundles = []
  }

  update(): void {
    this.bundles = this.bundles.filter(b => !b.isDestroyed)
  }
}
```

---

## Phase 4: Collision & Drop Logic

### Modified file: `frontend/src/game/systems/CollisionManager.ts`

**Constructor**: add optional `bundleManager?: DroppedBundleManager` as 5th parameter. Store as `private bundleManager`.

**`setupCollisions()`**: at end, add:
```typescript
if (this.bundleManager) {
  this.scene.physics.add.overlap(
    this.player,
    this.bundleManager.getGroup(),
    this.handlePlayerBundleCollision.bind(this) as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback
  )
}
```

**New `handlePlayerBundleCollision()`**:
```typescript
private handlePlayerBundleCollision(
  _player: Phaser.Tilemaps.Tile | Phaser.Types.Physics.Arcade.GameObjectWithBody,
  bundleContainer: Phaser.Tilemaps.Tile | Phaser.Types.Physics.Arcade.GameObjectWithBody
): void {
  const container = bundleContainer as Phaser.GameObjects.Container
  const bundle = container.getData('bundleInstance') as DroppedUpgradeBundle
  if (!bundle || bundle.isDestroyed) return

  const contents = bundle.getContents()
  this.bundleManager!.destroyBundle(bundle)
  EventBus.emit('bundle-picked-up', contents)
}
```

**`handleProjectileEnemyCollision()`** — after `GameManager.addKill()` (line ~131), before `UpgradeEffectSystem.onEnemyKill(enemy)`:
```typescript
// Drop bundle at half the score-drop probability
if (Math.random() < enemy.scoreChance * 0.5) {
  EventBus.emit('spawn-bundle', { x: enemy.x, y: enemy.y })
}
```

---

## Phase 5: MainScene Integration

### Modified file: `frontend/src/game/scenes/MainScene.ts`

**New members**:
```typescript
bundleManager!: DroppedBundleManager
private pendingBundleIds: string[] = []
```

**`create()`** additions (in order):
1. Instantiate `DroppedBundleManager` *before* `CollisionManager`:
   ```typescript
   this.bundleManager = new DroppedBundleManager(this)
   ```
2. Pass it to `CollisionManager` constructor as 5th arg.
3. Add listeners:
```typescript
EventBus.on('spawn-bundle', (data: { x: number; y: number }) => {
  this.bundleManager.spawnBundle(data.x, data.y, GameManager.getState().wave)
})

EventBus.on('bundle-picked-up', (contents: BundleContents) => {
  this.applyBundleContents(contents)
  this.sound.play('select_upgrade', { volume: getDefaultVolume('select_upgrade') })
})

EventBus.on('wave-complete', () => {
  // Commit pending bundle IDs to permanent state
  const state = GameManager.getState()
  for (const id of this.pendingBundleIds) {
    state.appliedUpgrades.push(id)
    SaveManager.recordUpgradePurchase(id, state.wave)
  }
  this.pendingBundleIds = []
  this.bundleManager.clearAll()
})
```

**`update()`**: add `this.bundleManager.update()` before `this.enemyManager.update(...)`.

**New `applyBundleContents(contents: BundleContents)`**:
```typescript
private async applyBundleContents(contents: BundleContents): Promise<void> {
  for (const upgrade of contents.upgrades) {
    await this.applyUpgrade(upgrade.id, /*skipCost*/ true, /*isRestore*/ false, /*isTemporary*/ true)
    this.pendingBundleIds.push(upgrade.id)
  }
  for (const curse of contents.curses) {
    this.applyCurse(curse)
    this.pendingBundleIds.push(curse.id)
  }
  // Record for backend submission (online mode)
  waveValidation.recordBundlePickup(
    contents.upgrades.map(u => u.id),
    contents.curses.map(c => c.id)
  )
}
```

**Modify `applyUpgrade()`** signature: add 4th param `isTemporary: boolean = false`. When `true`, skip:
- `currentState.appliedUpgrades.push(upgradeId)`
- `SaveManager.recordUpgradePurchase(upgradeId, currentWave)`
- `waveValidation.selectUpgrade()` call

All game-system effects (UpgradeSystem, modifiers, health/speed/polygon changes, dash charges) still apply immediately. The caller (`applyBundleContents`) tracks the ID in `pendingBundleIds` and commits at wave end.

**New `applyCurse(curse: CurseDefinition)`**:
```typescript
private applyCurse(curse: CurseDefinition): void {
  const stats = GameManager.getPlayerStats()

  if (curse.target === 'player' && curse.stat === 'maxHealth' && curse.value) {
    // Floor: BASE_PLAYER_STATS.maxHealth (100) — can't go below un-upgraded baseline
    const newMax = Math.max(BASE_PLAYER_STATS.maxHealth, stats.maxHealth + curse.value)
    GameManager.updatePlayerStats({
      maxHealth: newMax,
      health: Math.min(stats.health, newMax),
    })
  } else if (curse.target === 'attack' && curse.stat === 'damage' && curse.value) {
    // Floor enforced in UpgradeModifierSystem.applyModifiers (result >= baseValue)
    UpgradeModifierSystem.addModifier('attack', 'damage', curse.value, /*isMultiplier*/ false)
  }
}
```

---

## Phase 6: Bundle Pickup Notification (UI)

### New file: `frontend/src/components/BundlePickupNotification.tsx`

React component. Subscribes to `'bundle-picked-up'` via EventBus on mount; unsubscribes on unmount.

**State**: `notifications: NotificationEntry[]` where:
```typescript
interface NotificationEntry {
  id: string           // crypto.randomUUID() or Date.now().toString()
  items: Array<{
    name: string
    rarity: string
    isCurse: boolean
  }>
}
```

On `bundle-picked-up` event: push new entry; set `setTimeout(() => removeEntry(id), 3000)`.

**Positioning**: `position: fixed`, `top: clamp(60px, 8vh, 90px)`, `left: 50%`, `transform: translateX(-50%)`, `zIndex: 9999`, `pointerEvents: none`.

**Per-notification card**:
```
┌──────────────────────────┐
│  Bundle Opened!          │
│  + Sharper Rounds   rare │  ← blue text
│  + Devastation    common │  ← gray text
│  ✦ Blunted Rounds  curse │  ← red text
└──────────────────────────┘
```

**Rarity text colors** (inline style):
```typescript
const RARITY_COLORS = {
  common: '#9ca3af', uncommon: '#22c55e', rare: '#3b82f6',
  epic: '#a855f7', legendary: '#eab308', curse: '#ef4444'
}
```

**Mobile scaling**: detect mobile via `/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)`. Apply smaller font/padding on mobile: `fontSize: isMobile ? '11px' : '14px'`, `padding: isMobile ? '6px 10px' : '10px 16px'`. `maxWidth: 'min(280px, 80vw)'`.

Enter animation: CSS `@keyframes slideDown` (translate Y -10px → 0, opacity 0 → 1, 200ms). Apply via `animation` style on each card.

### Modified file: wherever HUD is mounted (likely `frontend/src/components/GamePage.tsx`)

Add `<BundlePickupNotification />` inside the game overlay div alongside `<GameHUD />`. The component is fully self-contained (no props needed).

---

## Phase 7: Backend Validation (Online Mode — Phase 2)

### Modified file: `frontend/src/game/services/WaveValidation.ts`

Add:
```typescript
private pendingBundlePickups: Array<{ upgradeIds: string[]; curseIds: string[] }> = []

recordBundlePickup(upgradeIds: string[], curseIds: string[]): void {
  // Only record in online mode (no-op offline)
  if (!localStorage.getItem('token')) return
  this.pendingBundlePickups.push({ upgradeIds, curseIds })
}
```

Reset in `startWave()`: `this.pendingBundlePickups = []`

In `completeWave()` payload: add `bundle_pickups: this.pendingBundlePickups`.

### Modified file: `backend/app/core/upgrade_data.py`

Add `CURSE_DATA` dict (same shape as `UPGRADE_DATA`) with the 8 curse definitions from `curse_upgrades.json`. Export `ALL_VALID_CURSE_IDS: set[str] = set(CURSE_DATA.keys())`.

### Modified file: `backend/app/services/wave_service.py`

In `complete_wave()`, after existing validation:
```python
for bundle in payload.get('bundle_pickups', []):
    for uid in bundle.get('upgrade_ids', []):
        if uid not in ALL_VALID_UPGRADE_IDS:
            await flag_wave(token, reason="invalid_bundle_upgrade_id", detail=uid, severity="high")
    for cid in bundle.get('curse_ids', []):
        if cid not in ALL_VALID_CURSE_IDS:
            await flag_wave(token, reason="invalid_curse_id", detail=cid, severity="high")
```

No stat-drift validation for bundles in Phase 2 (ID validation only). Drift validation is deferred.

---

## Critical Files Summary

| File | Action | Notes |
|---|---|---|
| `frontend/src/game/systems/difficulty/DifficultyManager.ts` | **CREATE** | Singleton wrapping active Difficulty |
| `frontend/src/game/data/upgrades/curse_upgrades.json` | **CREATE** | 8 curse entries (4 damage, 4 health) |
| `frontend/src/game/entities/upgrades/DroppedUpgradeBundle.ts` | **CREATE** | Entity class + static content generator |
| `frontend/src/game/systems/DroppedBundleManager.ts` | **CREATE** | Lifecycle manager + physics group |
| `frontend/src/components/BundlePickupNotification.tsx` | **CREATE** | Auto-dismissing toast UI |
| `frontend/src/game/core/GameManager.ts` | **MODIFY** | Export `BASE_PLAYER_STATS` constant |
| `frontend/src/game/systems/upgrades/UpgradeModifierSystem.ts` | **MODIFY** | Clamp `attack/damage` result to base value |
| `frontend/src/game/services/WaveValidation.ts` | **MODIFY** | Use DifficultyManager; add `recordBundlePickup()` |
| `frontend/src/game/systems/CollisionManager.ts` | **MODIFY** | Bundle drop on kill + player-bundle overlap |
| `frontend/src/game/scenes/MainScene.ts` | **MODIFY** | bundleManager, pendingBundleIds, applyCurse(), isTemporary param |
| `frontend/src/components/GamePage.tsx` | **MODIFY** | Mount `<BundlePickupNotification />` |
| `backend/app/core/upgrade_data.py` | **MODIFY** | Add `CURSE_DATA` and `ALL_VALID_CURSE_IDS` |
| `backend/app/services/wave_service.py` | **MODIFY** | Validate `bundle_pickups` IDs in `complete_wave()` |

---

## Reused Existing Patterns

- `DifficultyManager.getCurrent().getRarityWeights(wave)` — plugs into existing `Difficulty` interface
- `UpgradeModifierSystem.addModifier(target, stat, value, isMultiplier)` — curses use this with negative values
- `GameManager.updatePlayerStats()` — `applyCurse()` uses for maxHealth floor enforcement
- `EventBus.emit / .on` — all cross-system communication
- `SaveManager.recordUpgradePurchase()` — called at wave end for bundle IDs (deferred)
- `MainScene.applyUpgrade()` — bundle upgrades call with `isTemporary=true`
- Mobile detection regex + 50% scale pattern from `GameHUD.tsx`
- Rarity color scheme aligned with `UpgradeModal.tsx`

---

## Verification Plan

1. **Bundle drops**: Kill enemies and confirm bundles appear at ~50% of `scoreChance` probability (triangle = 15%, boss = 50%).
2. **Bundle colors**: Common-only bundle = gray circle. Mixed common + rare bundle = blue circle (highest rarity wins).
3. **Curse floor — health**: With `maxHealth = 100` (no health upgrades), pick up a `-5 health` curse — `maxHealth` stays at 100. With `maxHealth = 150`, curse reduces correctly to 145.
4. **Curse floor — damage**: Apply enough damage curses to exceed all upgrade gains — bullet damage should stay ≥ weapon base damage.
5. **Deferred commit**: Verify `GameManager.getState().appliedUpgrades` does NOT contain bundle IDs mid-wave. Verify `pendingBundleIds` populates on pickup and clears after `wave-complete`.
6. **Wave-end flush**: Complete a wave after picking up a bundle. Bundle IDs appear in `appliedUpgrades` post-completion and are included in the save.
7. **Mobile**: On device emulator — notification stays within viewport. Bundles are reachable (20px hitbox radius in world space). Notification text scales down.
8. **DifficultyManager extensibility**: Manually call `DifficultyManager.setCurrent(customDifficulty)` in console — rarity rolls for bundles and the upgrade modal both change accordingly.
9. **Wave cleanup**: Leave a bundle on the map when wave ends — confirm it's removed before the upgrade selection phase opens.
10. **Backend (online)**: Complete a wave with bundle pickups while logged in. Confirm wave completion succeeds and `bundle_pickups` appears in the payload without triggering flags.