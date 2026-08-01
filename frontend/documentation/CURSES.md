# Curses

Curses are debuffs the player can pick up mid-run — never bought, only rolled. They are not a separate system: a curse is an ordinary `Upgrade` (see [UPGRADES.md](./UPGRADES.md) for the full def/instance/hook architecture) whose def sets `curse: true`. Everything else — the ledger, `onApply`, hooks, stacking, replay — works identically to a regular upgrade.

## Where they live

- **Files**: `frontend/src/game/upgrades/curses/` — one file per curse, same registry auto-discovery as every other category
- **Marker**: `UpgradeDef.curse?: boolean` (`frontend/src/game/upgrades/Upgrade.ts`) — the only thing that distinguishes a curse from a regular upgrade
- **Legacy**: the old JSON-based curse system (`curses.json`, a `curse: true` property on a plain JSON row) is gone. What remains lives under `frontend/src/game/data/upgrades/legacy/curses.json` for historical reference only and is not read by any code path

## How the `curse` flag is used

- **Bundle rolls** (`MainScene.pickCurse`) — filters `getAllUpgrades()` down to `u.curse === true`, by rarity, then `UpgradeSystem.canApply(u)`. Regular-upgrade rolls (`pickRegularUpgrade`) explicitly exclude curses (`if (u.curse) return false`). See [UPGRADE_BUNDLE.md](./UPGRADE_BUNDLE.md) for the full pickup flow — curses only ever enter play through bundle pickups today (no post-wave curse offers).
- **`UpgradeModifierSystem.addModifier(target, stat, value, isMultiplier, curse)`** — the `curse` flag is passed through so *additive* curse modifiers get clamped at 0 instead of driving a stat negative. Every current curse is multiplicative, so this guard has no live caller yet.
- **Pickup text** — `MainScene.showBundlePickupText` renders curse names in red (`def.curse` truthy) instead of the rarity color.

## Current curses (15)

Two implementation shapes, same as any upgrade: plain `stat_modifier` defs (empty class body, applied generically) and `effect` defs that override `modifyPlayerHurt` for behavior a stat channel can't express.

### Stat-modifier curses (empty class body)

| ID | Name | Rarity | Target.Stat | Value | Notes |
|---|---|---|---|---|---|
| `damage_reduc_1..5` | Weakness 1–5 | common→legendary | `attack.damage` | ×(−0.1% … −3.75%) | multiplicative, stacks to 99999 |
| `health_reduc_1..5` | Reduced Health 1–5 | common→legendary | `player.maxHealth` | −5 … −80 flat | additive, stacks to 99999 |
| `shattered_bullet_1..3` | Shattered Bullet 1–3 | uncommon/rare/epic | `bullet.damage` | −1 / −3 / −5 flat | additive, stacks to 99999 |

### Effect curses (hook override)

| ID | Name | Rarity | Effect | maxStacks |
|---|---|---|---|---|
| `fragility_1` | Fragility 1 | rare | +1.25% damage taken | 3 |
| `fragility_2` | Fragility 2 | epic | +3.5% damage taken | 1 |

```ts
// curses/fragility_1.ts
export class Fragility1 extends Upgrade {
  onApply(): void {} // stat fields are metadata only; behavior is the hook

  modifyPlayerHurt(damage: DamageRef): void {
    damage.amount *= 1 + this.def.value!
  }
}
```

## Adding a new curse

Same as [adding any upgrade](./UPGRADES.md#adding-a-new-upgrade), plus `curse: true` on the def:

1. New file in `frontend/src/game/upgrades/curses/`
2. Export `<Name>Def: UpgradeDef` with `curse: true`, and `class <Name> extends Upgrade`
3. Simple stat penalty → leave the class body empty (a negative `value` on a `stat_modifier` def is all that's needed). Behavior-driven curse → override a hook, same as a regular effect upgrade
4. Regenerate the backend copy: `python3 scripts/upgrade_defs_sync.py --write` (or `./sync-check.sh` to check for drift first)

No separate curse pool, filter list, or registration step — the `curse: true` flag on the def is the entire mechanism.
