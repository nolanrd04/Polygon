# Upgrade Manager

The upgrade system lives in `frontend/src/game/systems/upgrades/` and is split across four files. All four are exported from `index.ts` for convenient importing.

---

## UpgradeSystem

**File:** `UpgradeSystem.ts`  
**Export:** `UpgradeSystem` (singleton)

The top-level coordinator. Tracks which upgrades have been applied, enforces stack limits and dependencies, and routes each upgrade to the correct sub-system.

### UpgradeDefinition shape

```ts
{
  id: string
  name: string
  description: string
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'
  type: 'stat_modifier' | 'variant' | 'effect' | 'visual_effect' | 'ability'

  // stat_modifier
  target?: string        // e.g. 'bullet', 'player'
  stat?: string          // e.g. 'damage', 'speed'
  value?: number
  isMultiplier?: boolean // true = multiplicative, false = additive

  // variant
  variantClass?: string  // e.g. 'HomingBullet'
  replaces?: string[]    // variant IDs this replaces

  // effect / visual_effect / ability
  effect?: string        // effect ID registered in EffectHandlers
  effectValue?: number

  stackable: boolean
  maxStacks?: number
  tier?: number
  upgradesTo?: string    // ID of next tier

  dependentOn?: string[] // IDs that must be owned first
  dependencyCount?: number // How many deps required (default 1)
  incompatibleWith?: string[]
  cost?: number
}
```

### Key methods

| Method | Description |
|--------|-------------|
| `applyUpgrade(upgrade)` | Validates, applies, tracks, and emits `upgrade-applied`. Returns `false` if blocked. |
| `canApply(upgrade)` | Checks dependencies, incompatibilities, and stack limits. |
| `removeUpgrade(upgradeId)` | Removes from tracking and delegates to the appropriate sub-system. |
| `decrementUpgrade(upgradeId)` | Reduces stack by 1, or removes entirely if last stack. Used by dev tools. |
| `getVariant(target)` | Returns the active variant class name for a target (e.g. `'HomingBullet'`), or `null`. |
| `hasEffect(effectId)` | Delegates to `UpgradeEffectSystem`. |
| `getEffectValue(effectId)` | Delegates to `UpgradeEffectSystem`. |
| `getAppliedUpgrades()` | All applied `UpgradeDefinition` objects. |
| `getStackCount(upgradeId)` | Number of times a stackable upgrade has been applied. |
| `reset()` | Clears all state. Called on new game. |

### Routing by type

| Type | Delegated to |
|------|-------------|
| `stat_modifier` | `UpgradeModifierSystem.addModifier()` |
| `variant` | Sets `activeVariants[target] = variantClass`; removes replaced variants |
| `effect` | `UpgradeEffectSystem.addEffect()` |
| `visual_effect` | `UpgradeEffectSystem.addVisualEffect()` |
| `ability` | `UpgradeEffectSystem.addAbility()` |

---

## UpgradeModifierSystem

**File:** `UpgradeModifierSystem.ts`  
**Export:** `UpgradeModifierSystem` (singleton)

Stores and applies numeric stat modifiers. Each modifier targets a specific stat on a specific entity type (e.g. `damage` on `bullet`).

### Formula

```
finalValue = (baseValue + additive) × (1 + multiplicative)
```

Multiple additive upgrades sum linearly. Multiple multiplicative upgrades also sum (5% + 5% = 10%, not 10.25%).

### Methods

| Method | Description |
|--------|-------------|
| `addModifier(target, stat, value, isMultiplier)` | Adds to additive or multiplicative total for `target.stat` |
| `removeModifier(target, stat)` | Deletes all modifiers for `target.stat` (use with non-stackable upgrades) |
| `applyModifiers(target, stat, base)` | Returns `(base + additive) × (1 + multiplicative)` |
| `getAdditiveModifier(target, stat)` | Raw additive total |
| `getMultiplicativeModifier(target, stat)` | Raw multiplicative total |
| `getAllAdditiveModifiers(target)` | All additive modifiers as a `Map<stat, value>` |
| `getAllMultiplicativeModifiers(target)` | All multiplicative modifiers as a `Map<stat, value>` |
| `reset()` | Clears all modifiers |
| `debug()` | Logs all active modifiers to console |

Targets used in practice: `'bullet'`, `'player'`, `'laser'`, `'zapper'`, `'flamer'`, `'spinner'`, `'attack'` (global damage modifiers).

---

## UpgradeEffectSystem

**File:** `UpgradeEffectSystem.ts`  
**Export:** `UpgradeEffectSystem` (singleton)

Manages non-numeric upgrade behaviors — effects that trigger on game events. Tracks three separate categories:

| Category | Storage | API |
|----------|---------|-----|
| Effects | `Map<effectId, totalValue>` | `addEffect / removeEffect / hasEffect / getEffectValue` |
| Visual effects | `Map<effectId, UpgradeDefinition>` | `addVisualEffect / removeVisualEffect / hasVisualEffect / getVisualEffect` |
| Abilities | `Set<abilityId>` | `addAbility / removeAbility / hasAbility` |

### Event triggers

Called by game systems at the appropriate moment:

| Trigger | Caller | Description |
|---------|--------|-------------|
| `onProjectileHit(projectile, enemy)` | `CollisionManager` | Fires `onHit` handlers for all active effects |
| `onEnemyKill(enemy)` | `CollisionManager` | Fires `onKill` handlers |
| `onUpdate(deltaTime)` | `MainScene` | Fires `onUpdate` handlers each frame |
| `onPlayerDamage(amount)` | `Player.takeDamage()` | Runs `onDamage` handlers, returns modified amount |
| `onEntitySpawn(entity)` | Spawn points | Fires `onSpawn` handlers |

---

## EffectHandlers

**File:** `EffectHandlers.ts`  
**Export:** `registerEffectHandlers()` — called once in `MainScene.create()`

Registers concrete behavior for each effect ID. An `EffectHandler` can implement any subset of `{ onHit, onKill, onUpdate, onDamage, onSpawn }`.

### Registered effects

| Effect ID | Trigger | Behavior |
|-----------|---------|----------|
| `lifesteal` | `onHit` | Heals player for `projectile.damage × lifeStealPercent` |
| `regen` | `onUpdate` | Heals player for `hps × (delta / 1000)` each frame |
| `armor` | `onDamage` | Returns `max(1, damage × (1 − reductionPercent))` |
| `thorns` | `onDamage` | Emits `thorns-reflect` with reflected damage; does not reduce incoming damage |
| `explode_on_kill` | `onKill` | Emits `enemy-explode` at the enemy position; damage is modified by `bullet.explosionDamage` modifiers |
| `dash` | — | Empty handler; ability tracked via `hasAbility('dash')` |
| `multishot` | — | Not a registered handler; effect value is read by `Player.shoot()` directly |
| `ricochet` | — | Not a registered handler; checked by `CollisionManager.processProjectileObstacleCollision()` |
| `shield` | — | Tracked via `getEffectValue('shield')` for charge count |
