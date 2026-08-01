# Upgrades System

Upgrades are modifications purchased during gameplay — simple stat increases, behavior-changing effects, weapon variants, abilities, and curses. The architecture is modeled on tModLoader's `ModBuff`: each upgrade is one self-contained file, and **the engine calls the upgrade's hooks — never the reverse**.

## Overview

- **Upgrade files**: `frontend/src/game/upgrades/` — one file per upgrade (77), organized by type
- **Registry**: `frontend/src/game/upgrades/index.ts` auto-registers every file in the category folders via `import.meta.glob` — `UPGRADE_REGISTRY` maps `id → { def, ctor }`
- **Base class**: `Upgrade` (`frontend/src/game/upgrades/Upgrade.ts`) — declarative `UpgradeDef` + overridable engine hooks
- **Engine**: `frontend/src/game/systems/upgrades/` — ledger, replay, hook dispatch, stat channels (see its README for engine internals)

## The Definition/Instance Split

Every upgrade file exports **two halves**:

```ts
// The catalog entry — plain JSON-serializable data. Browse/offer/UI code
// only ever touches this.
export const Damage1Def: UpgradeDef = {
  id: 'damage_1',
  name: 'Devastation',
  description: '+0.2% damage.',
  rarity: RarityID.Common,
  upgradeType: UpgradeTypeID.StatModifier,
  cost: 2,
  targetClass: UpgradeTargetID.Attack,
  fieldInTargetClass: UpgradeStatID.Damage,
  value: 0.002,
  isMultiplier: true,
  stackable: true,
  maxStacks: 99999,
}

// The behavior — instantiated fresh by the engine on every purchase.
// Empty body = the def is applied generically by the base class.
export class Damage1 extends Upgrade {}
```

Think item template vs. item drop: the def describes the upgrade; the player owns instances. Because instances are constructed per purchase (and reconstructed on save load), per-run mutable state on an upgrade class — a shot counter, say — is safe by construction and can never bleed across runs.

## The Ledger

The single source of truth for owned upgrades is an **ordered ledger**: one `Upgrade` instance per purchase, in acquisition order, held by `UpgradeSystem` and mirrored as an id array in `GameManager.getState().appliedUpgrades` (the serialized form). Everything else is derived from it:

- **Stack count** = number of instances with that id (no separate counters)
- **Application order** = ledger order. Mixed additive/multiplicative stacking is deliberately path-dependent (+10 flat then +10% ≠ +10% then +10 flat)
- **Removal, save-load restore, and dev reset are the same operation**: edit the ledger, then `UpgradeSystem.replay()` — reset all derived state to base and re-run every `onApply` in order. Current health is snapshotted across the replay, so loading never double-applies maxHealth upgrades and removing never heals
- **Base/derived stat separation**: `GameManager` keeps per-run base stats (100 HP / 200 speed / 3 sides); current stats are always base + ledger replay

## Hooks

The base class declares the hook set; the engine (`UpgradeSystem.dispatch*`) invokes overridden hooks on every owned instance, in ledger order, from exactly one generic line per extension point:

| Hook | Fires | Dispatch point | Example |
|---|---|---|---|
| `onApply(ctx)` | On purchase, and per instance on replay | `UpgradeSystem.apply/replay` | double_dash sets dash charges |
| `onRemove(ctx)` | When an instance leaves the ledger | `UpgradeSystem.removeOne` | (rarely needed — replay covers most undo) |
| `modifyProjectileSpawn(p)` | Every player projectile before spawn | `MainScene.spawnProjectile` | homing_distance bumps `trackingDistance` |
| `modifyHitEnemy(p, enemy, dmg)` | Before a hit's damage is applied | `CollisionManager` | (mutate `dmg.amount` in place) |
| `onHitEnemy(p, enemy, dealt)` | After a hit landed | `CollisionManager` | vampirism heals % of damage dealt |
| `modifyPlayerHurt(dmg, source?)` | Player takes damage (`source` = melee enemy) | `Player.takeDamage` | armor reduces, fragility amplifies, thorns reflects at `source` |
| `onEnemyKilled(enemy)` | Player kills an enemy | `CollisionManager` | explosion_on_kill emits an explosion |
| `updatePlayer(player, delta)` | Every frame | `MainScene.update` | regeneration heals per second |
| `modifyExplosion(explosion)` | Any player explosion is parameterized | `BulletExplosion.SetDefaults`, Chain Reaction | explosion_damage/radius upgrades |

`Enemy` exposes `maxHealth`, `isBoss`, and `takeDamage()` — enough for hooks that scale off enemy stats.

### Default `onApply` (why simple upgrades stay empty)

The base `onApply` applies the def generically, keyed on `upgradeType`:

- `stat_modifier` targeting player maxHealth/speed/polygonSides → mutates `GameManager` stats directly
- any other `stat_modifier` → `UpgradeModifierSystem.addModifier()` (shared stat channels; formula `(base + additive) × (1 + multiplicative)`, multiplicative bonuses sum)
- `effect` → `UpgradeEffectSystem.addEffect()` counter (shield charges, ricochet flag, ...)
- `ability` → `UpgradeEffectSystem.addAbility()` flag
- `visual_effect` → inert flag
- `variant` → nothing (the engine tracks the active variant itself)

Behavior-owning upgrades override hooks instead — and override `onApply(): void {}` when the def's stat fields are metadata-only (e.g. the explosion upgrades, whose numbers act through `modifyExplosion`, not the modifier channels).

### The flag pattern (allowed coupling)

Other files may branch on **whether** an upgrade is active — `Player.getBulletVariantClass()` reads `UpgradeSystem.getVariant()`, `CollisionManager` checks `hasEffect('ricochet')` — but the numbers and behavior belong to the upgrade class. Never write an upgrade's value into an entity file.

## Core Concepts

### Stacking

- **Stackable** (`stackable: true`, up to `maxStacks`): one ledger instance per purchase; each instance contributes independently, so stacking falls out of dispatch naturally
- **Non-stackable**: refused by `canApply` once owned
- Query with `UpgradeSystem.getStackCount(id)` / `hasUpgrade(id)`

### Tiers, Dependencies, Incompatibilities

All declared on the def and enforced by `UpgradeSystem.canApply(def)`:

- `tier` / `upgradesTo` — linear progression chains (vampirism 1→2→3)
- `dependentOn: DependencyGroup[]` — every group must be satisfied (AND across groups); within a group, `count` of `ids` must be owned (OR/threshold, default 1). An id can require a minimum stack count instead of plain ownership: `{ id: 'damage_1', minStacks: 3 }`. Example: triple_dash needs `[{ ids: ['double_dash'] }]`
- `incompatibleWith` — mutual exclusion (homing vs. explosive bullets)
- `specificAttackType` — offer only for the matching equipped attack
- `replaces` (variants) — purchasing evicts the replaced variant's instances from the ledger, then replays

### Dependency Examples

All four patterns below reduce to the same `dependentOn: DependencyGroup[]` shape — an array of groups ANDed together, each group internally an OR/threshold over `count`. 1 and 3 are live in the codebase today; 2 and 4 are supported but not yet used by any shipped upgrade.

1. **Depends on one upgrade** — a single group, one id, default `count: 1`.
   ```ts
   // abilities/double_dash.ts
   dependentOn: [{ ids: ["dash_ability"] }],
   ```
   Refused by `canApply` until `dash_ability` is owned.

2. **Depends on upgrade A *and* upgrade B** — two separate groups; every group must be satisfied.
   ```ts
   // illustrative — no shipped upgrade needs this yet
   dependentOn: [
     { ids: ["dash_ability"] },
     { ids: ["explosive_bullets"] },
   ],
   ```
   Both must be owned — owning only `dash_ability` still leaves the second group `[{ ids: ["explosive_bullets"] }]` unmet.

3. **Depends on upgrade A *or* upgrade B** — one group, multiple ids, default `count: 1` (any single id in the list satisfies it).
   ```ts
   // stat_modifiers/explosion_damage_1.ts
   dependentOn: [{ ids: ["explosive_bullets", "explosion_on_kill"] }],
   ```
   Owning either `explosive_bullets` (the variant) or `explosion_on_kill` (the effect) is enough — either explosion source unlocks the follow-up damage upgrade.

4. **Depends on N stacks of an upgrade** — an id can be `{ id, minStacks }` instead of a bare string.
   ```ts
   // illustrative — no shipped upgrade needs this yet
   dependentOn: [{ ids: [{ id: "damage_1", minStacks: 3 }] }],
   ```
   `canMeetDependencies` checks `getStackCount('damage_1') >= 3` rather than plain ownership.

These compose: a group's `count` generalizes case 3 to "K of N" (not just "any one"), and groups AND together, so `[{ ids: ["a", "b", "c"], count: 2 }, { ids: [{ id: "d", minStacks: 5 }] }]` reads as "(2 of a/b/c) AND (5+ stacks of d)".

### Purchase Flow

1. UI/bundle/dev-tools code emits an id; `MainScene.applyUpgrade` looks up the registry entry and checks cost
2. `UpgradeSystem.apply(entry)` checks `canApply(def)`, constructs `new entry.ctor(entry.def)`, appends it to the ledger, runs `onApply`. A refusal returns `false` with **no side effects** (nothing recorded, no sound)
3. On success: purchase is recorded in `GameManager.addAppliedUpgrade()` + `SaveManager`, then validated with the backend (skipped for dev/free applies)

## Adding a New Upgrade

1. Create one file in the right category folder (`stat_modifiers/`, `effects/`, `variants/`, `abilities/`, `visual_effects/`, `curses/`)
2. Export a `<Name>Def: UpgradeDef` and a `class <Name> extends Upgrade`
3. Simple stat change → leave the class body empty. Behavior → override hooks; read your numbers from `this.def`
4. Done — registration is automatic (the registry globs the folder). No index edits, no entity edits, no engine edits.

```ts
// effects/frenzy.ts — a stateful example: every 3rd hit deals bonus damage
import { Upgrade, type UpgradeDef, type DamageRef } from '../Upgrade'
import type { Projectile } from '../../entities/projectiles/Projectile'
import type { Enemy } from '../../entities/enemies/Enemy'
import { RarityID, UpgradeTypeID } from '../../data/ID'

export const FrenzyDef: UpgradeDef = {
  id: 'frenzy',
  name: 'Frenzy',
  description: 'Every 3rd hit deals 5% of the enemy\'s max health as bonus damage',
  rarity: RarityID.Legendary,
  upgradeType: UpgradeTypeID.Effect,
  cost: 40,
  effectValue: 0.05,
  stackable: false,
}

export class Frenzy extends Upgrade {
  private hitCount = 0 // per-run state: safe, instances never outlive the run

  onApply(): void {}

  modifyHitEnemy(_p: Projectile, enemy: Enemy, damage: DamageRef): void {
    this.hitCount++
    if (this.hitCount % 3 === 0) {
      damage.amount += enemy.maxHealth * this.def.effectValue!
    }
  }
}
```

**Def checklist**: unique snake_case `id`; class name is the PascalCase of it; `rarity`/`upgradeType` from the `ID.ts` enums; keep the def JSON-serializable (it is code-generated into the backend's `upgrades.json`).

**Backend note**: the live backend reads `backend/app/core/data/upgrades.json`, which is **generated from these defs** — never hand-edit it. After adding/changing a def, run `python3 scripts/upgrade_defs_sync.py --write` to regenerate it, or `./sync-check.sh` to just check for drift (value-parity against every field, not just filenames).

## Bundle Pickup Flow

When a player collects an upgrade bundle (`MainScene` overlap handler):

1. Bundle destroyed immediately (prevents double-pickup), position saved for floating text
2. Roll item count: 1–4
3. Rarity weights capped at the bundle's tier and re-normalized (a rare bundle never yields epics)
4. Slot 1 is always a regular upgrade at the bundle's tier (falls back down-tier only if the pool is exhausted); remaining slots roll 30% curse / 70% regular
5. Candidates are filtered through `UpgradeSystem.canApply()` and de-duplicated within the bundle; bundles never silently replace an active variant
6. Each pick goes through the normal `applyUpgrade` path (free) with staggered pickup text (rarity-colored; curses red)

## Debugging

```ts
UpgradeSystem.getOwned()               // owned instances, acquisition order
UpgradeSystem.getStackCount('damage_1')
UpgradeModifierSystem.debug()          // dump stat channels
UpgradeEffectSystem.getEffectValue('shield')
```

DevTools (bottom-right in dev): left-click applies free, right-click removes one stack (ledger removal + replay), Reset All clears the ledger.
