# AbilitySystem

**File:** `frontend/src/game/systems/AbilitySystem.ts`
**Export:** `AbilitySystem` (singleton)

The single dispatch point between input and on-demand abilities — dash, shield, heal. It exists so that **adding an ability means adding one upgrade file**, not editing `MainScene`, `Player`, `TouchControlManager` and `AbilityDisplay`.

An ability is just an upgrade whose def carries an `activation` block plus an `onActivate` hook. `AbilitySystem` reads that block for the keybind, the charge queue, the HUD card and the mobile button.

---

## The activation block

Declared on `UpgradeDef` (`upgrades/Upgrade.ts`), JSON-serializable like the rest of the def so it mirrors into `backend/app/core/data/upgrades.json`:

```ts
activation: {
  key: 'H',                              // Phaser key name → `keydown-H`
  label: 'HEAL',                         // HUD card + mobile button text
  keyLabel: 'H',                         // optional short glyph for the key chip; defaults to `key`
  buttonColor: 0xdd4466,                 // mobile button fill (Phaser hex)
  theme: 'rose',                         // key into AbilityDisplay's THEMES table
  slot: 2,                               // display/layout order, low to high
  charges: 1,                            // recharging only
  cooldown: 8000,                        // recharging only — ms per charge
  cooldownStat: UpgradeStatID.HealCooldown,  // optional: stat channel that scales cooldown
}
```

`buttonColor` and `theme` look redundant but are not — one is a Phaser hex consumed by `TouchControlManager`, the other a Tailwind palette key consumed by `AbilityDisplay`.

`slot` is a **manual** ordering number (shield 0, dash 1, heal 2). Two abilities sharing a slot have undefined order relative to each other.

### Two charge models

The **presence of `cooldown` is the discriminator**:

| | declares | charges come from | spending | HUD |
|---|---|---|---|---|
| **recharging** (dash, heal) | `charges` + `cooldown` (+ `cooldownStat`) | `ChargeQueue` inside `AbilitySystem` | automatic on a successful activate | progress bar + `x{n}` |
| **consumable** (shield) | neither | the `UpgradeEffectSystem` counter named by the def's `effect` | the ability's own business (`Player.activateShield` decrements it) | one pip per charge |

Shield is `UpgradeTypeID.Effect`, stacks to 5, and its charges are consumed permanently — it never fits a cooldown queue, so the two models exist rather than hardcoding it.

---

## The `onActivate` hook

```ts
onActivate(ctx: UpgradeContext): boolean   // false = declined; nothing spent, no cooldown started
```

`AbilitySystem` checks **only** ownership and charge availability before dispatching. Every other condition lives in the ability's own `onActivate`:

- `ShieldAbility` — already shielded, or no charges in the effect counter
- `HealAbility` — already at full health (declining keeps the charge instead of burning it on a heal `GameManager.heal()` would clamp away)
- `DashAbility` — nothing to decline; `Player.performDash()` always returns `true`, since the charge queue already gated it

Returning `false` is a full no-op: no charge spent, no cooldown started.

The three shipped abilities are correspondingly tiny — `DashAbility.onActivate` is `return ctx.player?.performDash() ?? false`.

---

## Binding lifecycle

```
MainScene.create()  →  AbilitySystem.bind(scene)
MainScene shutdown  →  AbilitySystem.unbind()
```

`bind()` walks `UPGRADE_REGISTRY`, keeps every def with an `activation`, sorts by `slot`, and registers a `keydown-<key>` listener for **each one — owned or not**. The handler re-checks ownership on every press, so buying or losing an ability mid-run needs no listener churn.

`bind()` calls `unbind()` first, and `unbind()` removes its listeners explicitly, so a scene restart that skipped shutdown cannot double-fire.

> `AbilitySystem` is a singleton bound per scene — only one scene can own abilities at a time.

---

## Charge queues

`ChargeQueue` (private, in the same file) is a verbatim lift of `Player`'s old dash bookkeeping. Charges recharge **sequentially**: each spent charge queues behind any already in flight (`lastReadyTime`), so holding N charges never means N parallel timers.

| Method | Description |
|---|---|
| `setMax(n)` | Resize and refill — every charge comes back ready |
| `readyCount(now)` | Charges usable right now |
| `spend(now, cooldown)` | Take one ready charge, queueing its recharge behind the last one out; `false` if none available |
| `progress(now, cooldown)` | 0–1 progress of the charge next to return; 1 when none are out |

Cooldown is resolved per spend through `UpgradeModifierSystem.applyModifiers(player, cooldownStat, base)`, so `dash_cooldown_*` / `heal_cooldown_*` upgrades apply without the queue knowing they exist.

---

## Public API

| Method | Used by | Description |
|---|---|---|
| `bind(scene)` / `unbind()` | `MainScene` | Register/drop keybinds and all scene-held state |
| `activate(abilityId)` | keybind handler, `TouchControlManager` | The one path in. Checks ownership + charges, calls `onActivate`, spends on success |
| `isAvailable(abilityId)` | `TouchControlManager` | Owned and currently usable — drives mobile button visibility |
| `getBindings()` | `TouchControlManager` | Every registered binding in slot order, owned or not |
| `getSlots()` | `MainScene` → HUD | `AbilitySlotState[]` for owned abilities only, in slot order |
| `setCharges(id, n)` / `addCharges(id, delta)` | ability upgrades via `ctx.abilities` | Retune a charge ceiling |
| `resetCharges()` | `UpgradeSystem.replay()` | Rebuild every queue at its def baseline |

### `AbilitySlotState`

What the HUD consumes — `{ id, label, keyLabel, theme, ready, max, progress, recharges }`. `recharges` picks the render: a progress bar for recharging abilities, pips for consumable ones.

---

## `AbilityRuntimeLike` — how upgrades retune charges

`UpgradeContext` carries `abilities?: AbilityRuntimeLike`, a minimal structural view (`setCharges` / `addCharges` / `resetCharges`). Charge upgrades use it instead of `PlayerLike` growing a setter per ability:

> `PlayerLike` stays deliberately small — `readonly x` / `readonly y`, `updatePolygon()`, `performDash()`, `activateShield()`. Position is there because any hook may want to spawn an effect where the player is; ability-*specific* state does not belong on it.

```ts
// abilities/double_dash.ts
onApply(ctx: UpgradeContext): void {
  super.onApply(ctx)
  ctx.abilities?.setCharges('dash_ability', 2)
}

// abilities/heal_charges_1.ts — stackable, so relative
onApply(ctx: UpgradeContext): void {
  super.onApply(ctx)
  ctx.abilities?.addCharges('heal_ability', 1)
}
```

Structural rather than a direct import because `UpgradeSystem` hands the context out and `AbilitySystem` imports `UpgradeSystem` — a concrete import would be a cycle.

**Absolute vs. relative matters for replay.** `replay()` calls `resetCharges()` and then re-runs every owned instance's `onApply` in ledger order. The dash ladder (`double_dash` → 2, `triple_dash` → 3) is a tier chain with one owned instance, so `setCharges` is correct. `heal_charges_1` stacks ×2, and each stack's `onApply` runs on replay, so it must be `addCharges` or two stacks would compound wrongly.

---

## `starting: true` — permanent, never-offered abilities

A def flagged `starting: true` is granted at run start instead of bought:

- `UpgradeSystem.grantStartingUpgrades()` applies every flagged def not already owned and records it in `appliedUpgrades` exactly as a purchase would, returning the granted ids so `MainScene` can mirror them into `SaveManager`.
- `MainScene` calls it after **both** branches — new game *and* save restore — so a run saved before a starting ability existed picks it up on load. Already-owned is a no-op.
- The frontend offer roll (`MainScene.pickRegularUpgrade`), the offline roll (`WaveValidation`), and the backend's `_roll_upgrades` / `collect_upgrade_bundle` pools all skip `starting` upgrades — they are granted, never sold or won as loot.
- The backend seeds `STARTING_UPGRADES` (derived from `upgrades.json`, not hardcoded) into new saves and unions it into `valid_upgrades` during wave validation, so reporting a starting ability in `upgrades_used` is not flagged as an unauthorized upgrade.

Routing the grant through the ledger — rather than registering it directly in `AbilitySystem` — is what makes `dependentOn: [{ ids: ['heal_ability'] }]` resolve for its follow-up upgrades with zero extra code, on both sides.

---

## Shipped abilities

| id | key | type | charges | cooldown | notes |
|---|---|---|---|---|---|
| `shield_ability` | E | consumable | `shield` effect counter, stacks ×5 | — | `Player.activateShield()`, 3s duration |
| `dash_ability` | SPACE | recharging | 1 (→2 `double_dash`, →3 `triple_dash`) | 1500 ms, `dashCooldown` | `Player.performDash()` drives the physics burst |
| `heal_ability` | H | recharging | 1 (+1 per `heal_charges_1` stack, ×2) | 8000 ms, `healCooldown` | `starting: true`; heals `effectValue` (10%) of **max** health, scaled by `healAmount` |

Heal scales off **max** health rather than a flat number so it stays meaningful as `player_health_*` upgrades push maxHealth up. Regen and vampirism are unaffected; active healing is additive.

Its five follow-up upgrades: `heal_amount_1` (+20%, ×5), `heal_amount_2` (+45%, ×2), `heal_cooldown_1` (−10%, ×5), `heal_cooldown_2` (−25%, ×2), `heal_charges_1` (+1 charge, ×2).

---

## What stayed on `Player`

`Player` keeps `performDash()` and `updateDash()` — the burst drives the physics body every frame, which is entity movement that happens to be upgrade-triggered, not upgrade logic. Same reasoning that keeps ricochet in `Bullet` rather than `CollisionManager` (see [UPGRADES.md](UPGRADES.md#effect-upgrades-that-need-per-class-behavior)).

It sheds everything that existed only because of an upgrade: the charge fields and every dash getter/setter. `Player.dash()` became `performDash(): boolean`; `activateShield()` now returns `boolean` too, so declining propagates back to `AbilitySystem`.

`UpgradeEffectSystem` no longer stores an ability flag at all — `addAbility` / `removeAbility` / `hasAbility` and the `activeAbilities` set are gone. Ownership is derived from `UpgradeSystem.getOwned()`; the ledger was already the source of truth and mirroring it into a flag meant two things to keep in step.

---

## Adding an ability

1. Create the file in `upgrades/abilities/`, export a def with an `activation` block and a class overriding `onActivate`.
2. Pick an unused `slot`, a `theme` that exists in `AbilityDisplay`'s `THEMES` table, and a `key` no other binding uses.
3. Recharging? Set `charges` + `cooldown` (and add a `UpgradeStatID` + stat-modifier upgrades if it should be tunable). Consumable? Omit both and set `effect` to the counter you decrement yourself.
4. Add `starting: true` if it should be permanent from spawn.
5. `python3 scripts/upgrade_defs_sync.py --write`, then `./sync-check.sh`.

No edits to `MainScene`, `Player`, `TouchControlManager` or `AbilityDisplay`.

> **Parser note:** hex literals (`buttonColor: 0x44dd44`) and apostrophes inside comments in a def both used to break `scripts/upgrade_defs_sync.py`. Both are handled now — hex converts to decimal in `upgrades.json`, and the brace matcher skips comments — but they are the two shapes most likely to trip it again.

---

## Known limitations

- **`replay()` refills all charges.** `resetCharges()` reproduces exactly what the old `setMaxDashCharges(1)` did, so picking up a mid-wave bundle resets your dash and heal cooldowns. Pre-existing behavior, preserved deliberately.
- **No cap on heal fraction.** Modifiers could in principle push it past 1.0; `GameManager.heal()` clamps to `maxHealth`, so it is harmless today.
- **`heal_ability` carries `rarity: Common` and `cost: 0`**, both meaningless for a never-offered upgrade, but the def schema requires them.
