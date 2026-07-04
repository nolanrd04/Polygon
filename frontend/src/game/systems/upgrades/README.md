# Upgrade Engine

The engine half of the upgrade architecture. Upgrades themselves live in
`src/game/upgrades/` — one file per upgrade, exporting a declarative
`UpgradeDef` (plain data) and an `Upgrade` subclass (behavior). This folder
contains the systems that store, replay, and dispatch them.

The model is tModLoader's `ModBuff`: **the engine calls the upgrade, never the
reverse.** Entities contain one generic dispatch line per extension point and
know nothing about any specific upgrade.

## Core Systems

```
systems/upgrades/
├── UpgradeSystem.ts          # Owned-instance ledger, replay, hook dispatch
├── UpgradeModifierSystem.ts  # Shared stat channels (additive & multiplicative)
├── UpgradeEffectSystem.ts    # Polled counters/flags (shield charges, ricochet, dash)
├── index.ts                  # Exports
└── README.md                 # This file
```

### UpgradeSystem — ledger, replay, dispatch

The single source of truth for what the player owns is an **ordered ledger**:
one `Upgrade` instance per purchase, in acquisition order, mirrored by
`GameManager.getState().appliedUpgrades` (the serialized id list). Stack
counts, dependency checks, and application order are all derived from it —
there are no separate bookkeeping maps to drift.

- **Purchase** (`apply(entry)`) — constructs a fresh instance from the
  registry's `{ def, ctor }` pair, appends it, runs its `onApply`. Refuses
  (returns `false`) if `canApply(def)` fails; refusal has no side effects.
- **Removal** (`removeOne(id)`) / **restore from save** (`restore(entries)`)
  / **reset** are all the same operation: edit the ledger, then `replay()`.
- **`replay()`** resets every derived surface to base (modifier channels,
  effect counters, variants, base player stats, dash charges), then re-runs
  `onApply` for each owned instance in ledger order. Current health is
  snapshotted and clamped to the recomputed max, so loading a save never
  double-applies maxHealth and removing an upgrade never heals.

Because upgrades are permanent within a run, effects **accumulate once** on
apply rather than being recomputed per tick (deliberate deviation from
Terraria's per-tick `ResetEffects`). Application order is acquisition order —
mixed additive/multiplicative results are intentionally path-dependent.

### Hook dispatch points

`UpgradeSystem.dispatch*` iterates owned instances in ledger order and invokes
the hook on those that override it. Entity-side footprint is exactly one line
per extension point:

| Hook | Dispatched from |
|---|---|
| `modifyProjectileSpawn` | `MainScene.spawnProjectile` (player-owned only) |
| `modifyHitEnemy` / `onHitEnemy` | `CollisionManager.handleProjectileEnemyCollision` |
| `modifyPlayerHurt` | `Player.takeDamage` (melee passes the source enemy) |
| `onEnemyKilled` | `CollisionManager` kill resolution |
| `updatePlayer` | `MainScene.update` |
| `modifyExplosion` | `BulletExplosion.SetDefaults` and Chain Reaction's `onEnemyKilled` |

### UpgradeModifierSystem — shared stat channels

Named per-target stat pools (`attack/damage`, `bullet/speed`, ...) that
multiple upgrades contribute to via the default `StatModifier` `onApply`, and
that entities read generically — the equivalent of Terraria's
`player.statDefense`. Formula: `(base + additive) × (1 + multiplicative)`.
Damage is applied exactly once, at collision time (`CollisionManager`), never
at spawn.

### UpgradeEffectSystem — polled counters and flags

What survives of the old effect system: counters and flags other systems poll
(`shield` charges consumed by `Player.activateShield`, `ricochet` checked by
`CollisionManager`, `dash` ability, `multishot`, inert visual-effect flags).
Event-driven behavior (lifesteal, regen, protection, thorns, explode-on-kill)
now lives on the upgrade classes as hooks.

## The flag pattern (what other files may know)

Other files may branch on **whether** an upgrade or effect is active
(`UpgradeSystem.hasUpgrade('homing_bullets')`,
`UpgradeEffectSystem.hasAbility('dash')`) — but the **numbers and behavior
belong to the upgrade class**. If you find yourself writing an upgrade's value
into an entity file, it should be a hook override instead.

## Writing a new upgrade

One new file under `src/game/upgrades/<category>/`, exporting a def and a
class — registration is automatic (the registry globs the category folders).

```ts
import { Upgrade, type UpgradeDef, type DamageRef } from '../Upgrade'
import { RarityID, UpgradeTypeID } from '../../data/ID'

export const IronSkinDef: UpgradeDef = {
  id: 'iron_skin',
  name: 'Iron Skin',
  description: 'Reduce incoming damage by 4%',
  rarity: RarityID.Rare,
  upgradeType: UpgradeTypeID.Effect,
  cost: 10,
  effectValue: 0.04,
  stackable: true,
  maxStacks: 3,
}

export class IronSkin extends Upgrade {
  onApply(): void {} // behavior is the hook, skip the default counter

  modifyPlayerHurt(damage: DamageRef): void {
    damage.amount = Math.max(1, damage.amount * (1 - this.def.effectValue!))
  }
}
```

- Simple stat upgrades need **no class body at all** — the base `onApply`
  applies the def generically (modifier channel, player base stat, effect
  counter, or ability flag depending on `upgradeType`).
- Stackables get one instance per purchase; write per-instance behavior and
  stacking falls out naturally.
- Per-run mutable state (shot counters, ...) is safe as instance fields —
  instances are constructed fresh each purchase/restore and never outlive the
  run.
- `def` must stay JSON-serializable (no functions/class references): it is the
  future source for code-generating the backend's `upgrades.json`.

The bar: an upgrade with multi-stat changes plus stateful custom on-hit
behavior referencing enemy max health must be writable in that one file,
touching nothing else.
