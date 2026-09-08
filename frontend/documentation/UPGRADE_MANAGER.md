# Upgrade Manager

The engine half of the upgrade architecture lives in `frontend/src/game/systems/upgrades/`. Upgrades themselves (`frontend/src/game/upgrades/`) are one file per upgrade, each exporting a declarative `UpgradeDef` and an `Upgrade` subclass — see [UPGRADES.md](./UPGRADES.md) for that half. This doc covers the three systems that store, replay, and dispatch them.

The model is tModLoader's `ModBuff`: **the engine calls the upgrade, never the reverse.** Entities contain one generic dispatch line per extension point and know nothing about any specific upgrade. There is no separate effect-handler registry to keep in sync — an upgrade's behavior lives entirely on its own class.

```
systems/upgrades/
├── UpgradeSystem.ts          # Owned-instance ledger, replay, hook dispatch
├── UpgradeModifierSystem.ts  # Shared stat channels (additive & multiplicative)
├── UpgradeEffectSystem.ts    # Polled counters/flags (shield charges, ricochet, multishot)
├── index.ts                  # Exports
└── README.md                 # Engine-internals reference (kept current — this doc summarizes it)
```

---

## UpgradeSystem — ledger, replay, dispatch

**File:** `UpgradeSystem.ts`
**Export:** `UpgradeSystem` (singleton)

The single source of truth for what the player owns is an **ordered ledger**: one `Upgrade` instance per purchase, in acquisition order, mirrored by `GameManager.getState().appliedUpgrades` (the serialized id list). Stack counts, dependency checks, and application order are all derived from it.

### UpgradeDef shape

```ts
interface UpgradeDef {
  id: string
  name: string
  description: string
  rarity: RarityID                 // 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'
  upgradeType: UpgradeTypeID        // 'stat_modifier' | 'variant' | 'effect' | 'visual_effect' | 'ability'
  cost: number

  // stat_modifier
  targetClass?: UpgradeTargetID     // 'attack' | 'bullet' | 'player'
  fieldInTargetClass?: UpgradeStatID
  value?: number
  isMultiplier?: boolean            // true = multiplicative, false = additive

  // variant
  variantClass?: string             // e.g. 'HomingBullet'
  replaces?: string[]               // variant IDs this replaces

  // effect / visual_effect / ability
  effect?: string                   // effect ID read by UpgradeEffectSystem
  effectValue?: number

  specificAttackType?: string       // offer-filter: only for the matching equipped attack

  // on-demand abilities — see ABILITY_SYSTEM.md
  activation?: AbilityActivation    // key, label, theme, slot, charges/cooldown
  starting?: boolean                // granted at run start, never offered or sold

  stackable: boolean
  maxStacks?: number
  tier?: number
  upgradesTo?: string

  dependentOn?: DependencyGroup[]   // AND across groups; within a group, `count` of `ids` (OR/threshold)
  incompatibleWith?: string[]

  curse?: boolean                   // see CURSES.md
}
```

### Key methods

| Method | Description |
|--------|-------------|
| `apply(entry)` | Constructs `new entry.ctor(entry.def)`, checks `canApply`, appends to the ledger, runs `onApply`. Returns `false` with no side effects if refused. |
| `canApply(def)` | Checks dependencies (`dependentOn`), incompatibilities, stack limits, and `specificAttackType`. |
| `removeOne(id)` | Removes the most recently purchased instance of `id`, runs `onRemove`, then replays. |
| `restore(entries)` | Rebuilds the ledger from a saved id list, then replays. Used on save load. |
| `replay()` | Resets every derived surface to base (modifier channels, effect counters, variants, base player stats, and `AbilitySystem.resetCharges()`), then re-runs `onApply` for each owned instance in ledger order. Health is snapshotted/clamped across replay so loading never double-applies maxHealth and removing never heals. |
| `grantStartingUpgrades()` | Applies every `starting: true` def not already owned, records each in `appliedUpgrades` exactly as a purchase would, and returns the granted ids. Called by `MainScene` after **both** the new-game and save-restore branches, so an old save picks up an ability added since it was written. |
| `getContext()` | The `UpgradeContext` handed to hooks (`gameManager`, `player`, `scene`, `abilities`). Used by `AbilitySystem` when dispatching `onActivate`. |
| `getVariant(target)` | Active variant class name for a `targetClass`, or `null`. |
| `hasUpgrade(id)` / `getStackCount(id)` | Ownership / stack queries used by `canApply`, bundle pickers, and dependency checks. |
| `hasEffect(id)` / `getEffectValue(id)` | Delegate to `UpgradeEffectSystem`. |
| `getOwned()` | Owned instances, acquisition order. |
| `reset()` | Clears the ledger. Called on new game. |

### Hook dispatch points

`UpgradeSystem.dispatch*` iterates owned instances in ledger order and invokes the hook on those that override it. Entity-side footprint is exactly one generic line per extension point:

| Hook | Dispatched from | Example |
|---|---|---|
| `onApply(ctx)` | `apply()` / `replay()` | double_dash sets dash charges |
| `onRemove(ctx)` | `removeOne()` | rarely needed — replay covers most undo |
| `modifyProjectileSpawn(p)` | `MainScene.spawnProjectile` | homing_distance bumps `trackingDistance` |
| `modifyHitEnemy(p, enemy, dmg)` | `CollisionManager.handleProjectileEnemyCollision` | mutate `dmg.amount` before it lands |
| `onHitEnemy(p, enemy, dealt)` | `CollisionManager` (after the hit) | vampirism heals % of damage dealt |
| `modifyPlayerHurt(dmg, source?)` | `Player.takeDamage` (`source` = melee enemy) | armor reduces, fragility amplifies, thorns reflects at `source` |
| `onEnemyKilled(enemy)` | `CollisionManager` kill resolution | explosion_on_kill emits an explosion |
| `updatePlayer(player, delta)` | `MainScene.update` | regeneration heals per second |
| `modifyExplosion(explosion)` | `BulletExplosion.SetDefaults`, Chain Reaction | explosion_damage/radius upgrades |
| `onActivate(ctx): boolean` | `AbilitySystem.activate` (keybind or mobile button) | heal restores health; `false` declines and spends no charge |

### Default `onApply` — why simple upgrades stay empty

Applies the def generically, keyed on `upgradeType`, when a class doesn't override it:

| `upgradeType` | Routed to |
|---|---|
| `stat_modifier` targeting player maxHealth/speed/polygonSides | mutates `GameManager` base stats directly |
| any other `stat_modifier` | `UpgradeModifierSystem.addModifier()` |
| `effect` | `UpgradeEffectSystem.addEffect()` counter |
| `visual_effect` | `UpgradeEffectSystem.addVisualEffect()` flag |
| `ability` | nothing — ownership is the ledger; `AbilitySystem` derives it from `getOwned()` |
| `variant` | nothing — `UpgradeSystem` tracks the active variant itself |

Because upgrades are permanent within a run, effects accumulate once on apply rather than being recomputed per tick.

---

## UpgradeModifierSystem — shared stat channels

**File:** `UpgradeModifierSystem.ts`
**Export:** `UpgradeModifierSystem` (singleton)

Named per-target stat pools (`attack.damage`, `bullet.speed`, ...) that multiple upgrades contribute to via the default `stat_modifier` `onApply`, read generically by entities.

### Formula

```
finalValue = (baseValue + additive) × (1 + multiplicative)
```

Multiple additive upgrades sum linearly. Multiple multiplicative upgrades also sum (5% + 5% = 10%, not 10.25%). Damage is applied exactly once, at collision time (`CollisionManager`), never at spawn.

### Methods

| Method | Description |
|--------|-------------|
| `addModifier(target, stat, value, isMultiplier, curse?)` | Adds to the additive or multiplicative total for `target.stat`. `curse` clamps additive totals at 0. |
| `applyModifiers(target, stat, base)` | Returns `(base + additive) × (1 + multiplicative)`. |
| `getAdditiveModifier(target, stat)` / `getMultiplicativeModifier(target, stat)` | Raw totals. |
| `reset()` | Clears all modifiers. Called by `replay()`. |
| `debug()` | Logs all active modifiers to console. |

Targets used in practice: `attack` (global damage), `bullet`, `player`.

---

## UpgradeEffectSystem — polled counters and flags

**File:** `UpgradeEffectSystem.ts`
**Export:** `UpgradeEffectSystem` (singleton)

What survives of the old event-driven effect-handler system: counters and flags other systems poll directly, rather than event callbacks.

| Category | Storage | API |
|----------|---------|-----|
| Effects | counter map | `addEffect / removeEffect / hasEffect / getEffectValue` — e.g. `shield` charges consumed by `Player.activateShield`, `ricochet` checked in each `Projectile` subclass's `OnObstacleCollide()` |
| Visual effects | flag map | `addVisualEffect / removeVisualEffect / hasVisualEffect / getVisualEffect` — inert, read by rendering code |

There is **no ability flag store**. `addAbility / removeAbility / hasAbility` and the `activeAbilities` set were deleted: the ledger already knew who owned dash, and mirroring it into a flag meant two things to keep in step. `AbilitySystem` derives ownership from `UpgradeSystem.getOwned()`, and the default `onApply`'s `ability` case is a no-op alongside `variant`.

Event-driven behavior that used to live in a separate `EffectHandlers.ts` registry (lifesteal, regen, armor, thorns, explode-on-kill) now lives directly on the owning upgrade's class as a hook override (`onHitEnemy`, `updatePlayer`, `modifyPlayerHurt`, `onEnemyKilled`) — there is no `EffectHandlers.ts` file or `registerEffectHandlers()` call anymore. `multishot`'s value is read straight from `UpgradeEffectSystem.getEffectValue('multishot')` by `Player.shoot()`.

---

## The flag pattern (what other files may know)

Other files may branch on **whether** an upgrade or effect is active (`UpgradeSystem.hasUpgrade('homing_bullets')`, `UpgradeEffectSystem.hasEffect('ricochet')`) — but the numbers and behavior belong to the upgrade class. If you find yourself writing an upgrade's value into an entity file, it should be a hook override instead.

## Debugging

```ts
UpgradeSystem.getOwned()               // owned instances, acquisition order
UpgradeSystem.getStackCount('damage_1')
UpgradeModifierSystem.debug()          // dump stat channels
UpgradeEffectSystem.getEffectValue('shield')
```

DevTools (bottom-right in dev): left-click applies free, right-click removes one stack (ledger removal + replay), Reset All clears the ledger.
