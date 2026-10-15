# Buffs

Timed buffs and debuffs that sit on the player or on enemies, modeled on tModLoader's `ModBuff`. Like upgrades, each buff is one self-contained file and **the engine calls the buff's hooks, never the reverse**. Unlike upgrades, buffs are temporary per-entity state: they have no ledger, are never replayed, and are never saved.

```ts
player.AddBuff(BuffID.Mending, 5000)   // ms
enemy.AddBuff(BuffID.OnFire1, 3000)
enemy.AddBuff(BuffID.OnFire1, 3000, { stacking: false })                       // this application doesn't stack
enemy.AddBuff(BuffID.OnFire1, 3000, { stats: { [BuffStatID.LifeRegen]: -25 } })  // this application burns 25 HP/s
enemy.HasBuff(BuffID.OnFire1)
```

## Overview

- **Buff files**: `frontend/src/game/buffs/positive/` and `frontend/src/game/buffs/debuffs/`. One file per buff
- **Registry**: `buffs/index.ts` auto-registers every file in those folders via `import.meta.glob`. `BUFF_REGISTRY` maps `id → { def, ctor, shared }` (`shared` is one host-less instance, used by `dispatchProjectileHit`)
- **Base class**: `Buff` (`buffs/Buff.ts`). Declarative `BuffDef` + overridable hooks
- **Per-host state**: `BuffContainer` (active buffs + timers) and `BuffStats` (the per-tick stat layer), one of each on every `Player` and `Enemy`
- **IDs**: `BuffID`, `BuffHostID`, `BuffStatID` in `data/ID.ts`
- **Bundle whitelist**: `buffs/bundleDrops.ts` (see [Bundle drops](#bundle-drops))

## Hosts

Anything implementing `BuffHost` can carry buffs. Today that's `Player` and `Enemy`. Both expose the same tModLoader-style API:

| Method | Description |
|---|---|
| `AddBuff(id, ms, options?)` | Apply for `ms` milliseconds. Returns `false` if refused: unknown id, the def's `appliesTo` excludes this host kind, or the id is in the enemy's `buffImmune`. `options: { stacking?, stats? }` override the def for this one application (see [Stacking](#stacking) and [Per-application stat values](#per-application-stat-values)) |
| `HasBuff(id)` | Whether the buff is active |
| `ClearBuff(id)` | Remove it now (runs `onRemove`) |
| `GetBuffTime(id)` | Remaining ms, `0` if not active |

Projectiles are not hosts. Their damage picks up the owner's buff `Damage` at fire time (see [Outgoing damage](#outgoing-damage)), and the owner's buffs can stamp behavior onto them (see [Projectile stamps](#projectile-stamps)).

`BuffHost` declares `AddBuff` / `HasBuff` / `ClearBuff`, so a hook that only knows "whoever got hit" (`onProjectileHit`'s `target`) can still apply a buff without checking whether it's the player or an enemy.

**Multi-part enemies:** `Enemy.buffTarget` decides which enemy a buff actually lands on. `ArrowHeadPart` overrides it to return the shared-health owner, so a burn on any segment ticks the worm once rather than once per segment.

## Time

Buffs tick inside `MainScene.stepLogic`, so they run on the fixed 60 Hz logic step ([CORE.md](CORE.md#fixed-logic-timestep)). The API takes milliseconds; durations are stored as ticks (`msToTicks`). As a result:

- pausing stops buffs for free (no ticks run);
- a lagging device slows buffs together with the rest of the game instead of letting them expire mid-lag;
- refresh rate has no effect.

Order inside a tick, **before** the per-tick upgrade hooks and any movement/shooting:

1. `player._updateBuffs()`, then `enemy._updateBuffs()` for every live enemy
2. Each container: reset `BuffStats` → every buff's `applyStats` + `updatePlayer`/`updateEnemy` → `timeLeft--` → remove expired (`onRemove`)
3. The host consumes its life regen from `BuffStats`

A buff applied for N ticks affects exactly N ticks. The container iterates a snapshot, so a buff may add or clear buffs (including itself) from its own hook.

## Lifetime

- **Cleared at wave end.** `MainScene` clears the player's buffs when the wave completes. Enemies are all dead by then. Buffs therefore never need saving, and `UpgradeSystem.replay()` / save restore know nothing about them
- **Cleared on death.** Player on `player-death`; enemies in `_die()` / `_destroy()`

## BuffDef

Plain JSON-serializable data, like `UpgradeDef`, so the backend can later read the numbers for wave validation.

```ts
interface BuffDef {
  id: BuffID
  name: string
  description: string
  appliesTo: BuffHostID[]        // 'player' | 'enemy'
  isDebuff: boolean
  stacking: boolean              // see Stacking
  maxDuration?: number           // ms cap on remaining time
  hidden?: boolean               // left out of the HUD bar and ViewBuffs
  icon?: IconID                  // HUD icon, see HUD; omit for the generic buff/debuff icon
  color: number                  // icon color, and sprite tint if tintStrength is set
  tintStrength?: number          // 0-1, see Sprite tint
  stats?: { stat: BuffStatID; value: number; isMultiplier: boolean }[]
}
```

### Sprite tint

Set `tintStrength` to tint the host's sprite toward `color` while the buff is active (e.g. On Fire uses `0.4`). The blend is **per RGB channel**, so each entity keeps its own hue and just shifts toward the buff color. Adding the hex values together does not work: channels carry into each other and change the hue (blue + orange came out green).

- `BuffContainer.tint(base)` blends `base` toward every active tinting buff in turn, so multiple tints combine and can never go past the buff colors.
- **Enemies:** `Enemy.displayColor()` returns `color` with buff tints applied (read from `buffTarget`, so ArrowHead segments follow the head). `Draw()` and the hit-flash restore both use it. `enemy.color` itself is never modified, so the original color comes back as soon as the buff ends.
- **Player:** its texture already holds the player color, and Phaser tints by multiplying. So `_updateBuffs()` blends from white (`tint(0xffffff)`) and only calls `setTint` when the result changes. The tint is carried over when `Draw()` rebuilds the sprite for a sides change.

### Stacking

Stacking only ever affects **duration**. A buff's values are applied once no matter how many times it was reapplied.

| `stacking` | Reapplying an active buff |
|---|---|
| `true` | Adds the new duration to the remaining time |
| `false` | Keeps the **longer** of the remaining and the new duration, so a weak re-hit never shortens it |

`maxDuration` (if set) caps the result either way. Override `onReapply` and return `true` to handle the timer yourself.

**Per-call override:** `AddBuff(id, ms, { stacking })` uses the given rule for that one application instead of the def's. On Fire 1 stacks by default, but Burning Bullets 1 applies it with `{ stacking: false }`, so each bullet tops the burn back up to 5 s instead of piling on. Because non-stacking keeps the longer of the two, it never shortens a longer burn from a stacking source. A custom `onReapply` still takes priority over both.

## Stats: the BuffStats layer

Each host has a `BuffStats` object: a set of totals that is **zeroed every tick, rebuilt by the host's active buffs, then read where the stat is used**. A buff that changes a stat never edits the entity's own fields; it contributes to `BuffStats`.

Formula, same as `UpgradeModifierSystem`: `(base + additive) × (1 + multiplicative)`, via `buffStats.apply(stat, base)`.

| `BuffStatID` | Host | Consumed in | Notes |
|---|---|---|---|
| `LifeRegen` | both | `Player._updateBuffs`, `Enemy._updateBuffs` | HP/sec, additive. Positive heals (clamped to max). Negative is damage over time |
| `MoveSpeed` | player | `Player.move` | `speed × factor`. Dash is unaffected |
| `MoveSpeed` | enemy | `Enemy._update`, on the final `body.setVelocity` | Scales the body only. AI that writes `this.speed`/`velocityX` as state (Diamond, Dodecahedron) never sees it |
| `Damage` | both | `MainScene.spawnProjectile` → `projectile.damageMultiplier` | Fixed at fire time from the owner's buffs. See [Outgoing damage](#outgoing-damage) |
| `Damage` | enemy | `CollisionManager` melee contact | `enemy.damage × factor` |
| `FireRate` | player | `Player.shoot` | Shot cooldown ÷ factor (+0.3 → 30% more shots) |
| `DamageTaken` | player | `Player.takeDamage` | After upgrade armor/fragility and buff `modifyPlayerHurt` |
| `DamageTaken` | enemy | `Enemy.takeDamage` | Multiplies what's left after armor (min 1 still applies) |
| `Defense` | enemy | `Enemy.effectiveDefense` | Flat armor on top of `defense`; projectile penetration still applies |

Multiplier stats are read as `buffStats.apply(stat, 1)` (a factor); flat ones as `apply(stat, base)`. A debuff is just a negative value: Chilled is `MoveSpeed −0.4`. Enemies read through `enemy.buffStat(stat, base)`, which goes via `buffTarget` so Arrow Head segments use the head's buffs.

Buff damage over time ignores `DamageTaken` and `Defense` (Terraria behaves the same).

### Per-application stat values

A def's `stats` values are fixed, so On Fire 5's `-10` burns the same on wave 1 and wave 30. To make one application stronger or weaker, pass `stats` in `AddBuff`'s options. It replaces the def's value for the listed stats on that instance only; stats you don't list keep the def's value.

```ts
// burning_bullets_5.ts — burn scales with the hit, with the def's value as a floor
onProjectileHit(projectile: Projectile, target: BuffHost): void {
  const base = -OnFire5Def.stats![0].value              // 10 HP/s
  const burn = Math.max(base, projectile.damage * 0.1) // HP/s
  target.AddBuff(BuffID.OnFire5, 10000, { stacking: false, stats: { [BuffStatID.LifeRegen]: -burn } })
}
```

- **Watch the sign.** Burns are negative `LifeRegen`, so `Math.max(-10, -25)` picks the *weaker* burn. Do the math in positive HP/s and negate when passing it.
- **Only declared stats.** An override for a stat the def doesn't list in `stats` is ignored.
- **Reapplying keeps the stronger value.** If the buff is already active, each declared stat keeps whichever is larger in magnitude: the current value or the incoming one (the override, or the def's value if none was passed). A weak hit never downgrades a strong burn; a stronger hit upgrades it. Duration follows the stacking rule independently.
- Stored on the instance as `statOverrides`; `Buff.statValue(stat)` returns the value it's currently applying. The default `applyStats` uses the override when present, so pure stat buffs still need no class body.
- A buff that overrides `applyStats` itself must read `this.statValue(stat)` to respect overrides.

### Outgoing damage

Projectile damage is fixed when the projectile spawns (fire time). `MainScene.spawnProjectile`, which every projectile passes through, multiplies `projectile.damageMultiplier` by the owner's buff `Damage`: the player's, or the enemy found by `ownerId` (`EnemyManager.getEnemyById`). Collision then deals `damage × damageMultiplier`, on both sides.

It goes on `damageMultiplier`, not `damage`, because secondary projectiles copy their parent's `damage` (`AcidBullet` → `AcidExplosion`, the SuperPentagon detonation, player bullet explosions) but never its multiplier. Touching `damage` would buff those children twice. This way every projectile, children included, is buffed exactly once, by its owner's state at the moment it spawned. A projectile an enemy spawns from `OnDeath` is unbuffed, since buffs clear when it dies.

### Walkthrough: how `OnFire`'s `value: -8` becomes damage

`OnFireDef` declares `stats: [{ stat: BuffStatID.LifeRegen, value: -8, isMultiplier: false }]`. Every logic tick:

1. `MainScene.stepLogic` calls `enemy._updateBuffs()`
2. → `BuffContainer.update()` zeroes the enemy's `buffStats`, then for each active buff:
   - runs `Buff.applyStats()` — the **base-class** method, not visible in `on_fire.ts` — which loops over `def.stats` and does `buffStats.add(LifeRegen, -8)`
   - runs `OnFire.updateEnemy()` (the embers)
   - counts `timeLeft` down
3. → back in `Enemy._updateBuffs()`: reads the `LifeRegen` total (−8 HP/sec), converts it to this tick's share (`-8 × FIXED_STEP_MS / 1000` ≈ −0.13), and calls `takeBuffDamage(0.13)`

Result: a smooth 8 HP per second. Expressing it as "HP per second" rather than "subtract X every N ticks" keeps the number honest: `health -= 8` every 6 ticks would be 80 HP/sec, not 8.

### Why buffs don't edit `speed` / `damage` / `maxHealth` directly

A timed buff must undo itself when it ends, and in this codebase direct edits can't be undone reliably:

- **Enemy AI writes its own stats.** `Diamond` and `Dodecahedron` set `this.speed` as part of their AI state machine. A Slow buff doing `speed = 30` would be overwritten by the AI next tick, or, on expiry, restore a value the AI no longer wants and leave the enemy stuck at the wrong speed. Difficulty also scales `speed` once at spawn.
- **Overlapping buffs corrupt each other's undo.** Haste (×1.5) and Chilled (×0.5) on the same field, ending at different times: whichever restores its saved value first gets it wrong.
- **Player stats belong to the upgrade replay.** Speed, max health, etc. live in `GameManager` and `UpgradeSystem.replay()` rebuilds them from base + upgrades. A buff's edit would be wiped mid-buff or baked in permanently.

Because `BuffStats` starts at zero every tick, a buff that ends simply stops contributing. **Nothing ever has to be undone**, buffs stack correctly in any order, and the AI and upgrade replay never see buffs at all.

This is tModLoader's pattern too: buffs never touch `player.statLifeMax`, they write `statLifeMax2` / `moveSpeed` / `statDefense` / `npc.lifeRegen`, which `ResetEffects` restores every tick. `BuffStats` is exactly those fields, kept in a separate object because our entities' own fields aren't reset each tick.

### Do new buffs need new stats?

Rarely:

- **Behavior buffs need none.** Explode on death, spawn sparks on hit, apply a debuff on contact: these are hooks (`updateEnemy`, `onHitEnemy`, fire-time projectile stamps).
- **Stat buffs reuse existing stats.** Haste, Slow, Chilled and Frozen all write `moveSpeed`. Mending, OnFire, Poison and Bleeding all write `LifeRegen`.
- **A genuinely new kind of number** costs one `BuffStatID` entry plus one consumption line where the game reads it. Once.

The current set (life regen, move speed, damage, fire rate, damage taken, defense) covers most of Terraria's buff list.

### Rule for buff authors

| You want to... | Do this |
|---|---|
| Change a stat for as long as the buff lasts | Declare it in `stats` (writes `BuffStats`) |
| Change a resource once (heal 20 on apply, a burst of damage) | Call the normal method from a hook: `GameManager.heal()`, `enemy.takeBuffDamage()` |
| Anything else (spawn things, react to hits) | Override a hook |

Health is the one field that is fine to change directly, because it's a resource, not a stat. Ongoing drain still goes through `LifeRegen` so that one buff damage path decides death and kill credit; `enemy.health -= x` from a hook could leave an enemy at 0 HP without dying or awarding the kill.

### Damage over time

Negative life regen deals damage every tick, so it deliberately skips the normal hit path:

- **Enemies** (`takeBuffDamage`): ignores `defense`, skips `OnHit`, the hit sound and the white flash. A kill returns `true` from `_updateBuffs`, and `MainScene` awards it through `awardPlayerKill()` (`systems/KillRewards.ts`). That is the same function `CollisionManager` uses for bullet kills, so a burn kill gives kill count, points, on-kill upgrade hooks and bundles exactly like a bullet kill
- **Player**: skips upgrade armor (`modifyPlayerHurt`), the shield, and the hurt flash/sound, but is still recorded with `waveValidation.recordDamageTaken`

**`LifeRegen` has no base value**, so an `isMultiplier: true` regen stat on its own does nothing (`(0 + flat) × (1 + m)`); it only scales flat regen from other buffs. For "% of max HP" regen, add a flat amount computed from the host each tick in `updatePlayer` / `updateEnemy`, as `mending.ts` does.

## Hooks

| Hook | Fires |
|---|---|
| `onApply(host)` | The buff landed on a host that didn't have it |
| `onReapply(host, ticks): boolean` | The host already has it. Return `true` if you set `timeLeft` yourself |
| `onRemove(host)` | Expiry, `ClearBuff`, wave end, or host death |
| `applyStats(stats)` | Every tick. Default writes the def's `stats`. Rarely overridden |
| `updatePlayer(player)` | Every tick on a player — `ModBuff.Update(Player)` |
| `updateEnemy(enemy)` | Every tick on an enemy — `ModBuff.Update(NPC)` |
| `drawPlayer(player)` | Every tick, at the end of `Player.update()` |
| `drawEnemy(enemy)` | Every tick, after the enemy's `PostDraw()`. ArrowHead segments each get their own call (with the head's buffs) |
| `modifyPlayerHurt(player, damage, source?)` | On a player: incoming damage, after upgrade armor and before `DamageTaken`. `source` is the enemy for melee contact |
| `modifyEnemyHurt(enemy, damage)` | On an enemy: incoming damage, before armor |
| `modifyHitEnemy(projectile, enemy, damage)` | On a player: one of their projectile hits, before it lands |
| `onHitEnemy(projectile, enemy, dealt)` | On a player: after one of their projectile hits landed. Reads the player's buffs **at hit time**; for fire-time behavior use a stamp instead |
| `modifyProjectileSpawn(projectile)` | On any host: a projectile it fires is about to spawn (`MainScene.spawnProjectile`). Stamp `projectile.buffFlags` here |
| `onProjectileHit(projectile, target)` | A projectile stamped with this buff's id hit `target` (an enemy for player shots, the player for enemy shots). Runs on the **shared** instance |

The damage hooks are called right after the matching `UpgradeSystem.dispatch*` line (`Player.takeDamage`, `CollisionManager`), so upgrades always act first. `DamageRef` is the same mutable `{ amount }` wrapper upgrades use.

`timeLeft` (ticks) is readable inside hooks, handy for "every N ticks" effects (`OnFire` emits an ember every 6 ticks).

**Draw hooks vs `update*`:** tint and particles cover most visuals and belong in `updatePlayer` / `updateEnemy`. `drawPlayer` / `drawEnemy` are for persistent overlays (a ring, an aura): create the game object in `onApply`, position it in the draw hook, destroy it in `onRemove`.

### Projectile stamps

For behavior a buff gives **every** projectile its holder fires (Burning Bullets: ignite whatever it hits), keep both halves in the buff file:

```ts
// buffs/positive/burning_bullets_1.ts
export class BurningBullets1 extends Buff {
  modifyProjectileSpawn(projectile: Projectile): void {
    projectile.buffFlags.add(this.id)
  }

  onProjectileHit(_projectile: Projectile, target: BuffHost): void {
    target.AddBuff(BuffID.OnFire1, 5000, { stacking: false })
  }
}
```

- **No `HasBuff` check needed.** `modifyProjectileSpawn` is only dispatched for buffs the shooter currently has.
- **Fire time, not hit time.** `CollisionManager` calls `dispatchProjectileHit` (`buffs/index.ts`), which runs `onProjectileHit` for each id in `projectile.buffFlags`. A shot fired at 4.9 s of a 5 s buff still ignites when it lands at 5.4 s.
- **Both sides.** Enemy shooters dispatch too (through `buffTarget`), so the same buff on an enemy ignites the player.
- **Shared instance.** The shooter's own buff instance may be gone when the shot lands, so `onProjectileHit` runs on the registry's `shared` instance. Don't read `this` state or `timeLeft` there; read numbers from `this.def`.
- **Hit only.** It fires on a damaging hit that didn't kill (player shots) or any hit on the player (enemy shots). It doesn't fire when `OnHitNPC` returned `false`. AOE that is a real projectile (`BulletExplosion`) is stamped and dispatches like any shot; `enemy-explode` damage (enemy self-detonation) is not a projectile and never dispatches.
- Child projectiles (explosions, pellets) spawn through `spawnProjectile` too, so they're stamped by the shooter's buffs at their own spawn time.

For one specific projectile class applying a debuff, override `Projectile.OnHitPlayer(player)` / `OnHitNPC(enemy)` (or `Enemy.OnHitPlayer(player)` for melee) in that class instead.

## Adding a buff

1. Add an id to `BuffID` in `data/ID.ts`
2. Create one file in `buffs/positive/` or `buffs/debuffs/` exporting a `<Name>Def: BuffDef` and a `class <Name> extends Buff`
3. Pure stat buff → declare `stats` and leave the class body empty. Behavior → override hooks and read numbers from `this.def`
4. Done. Registration is automatic

```ts
// pure stat buff (flat regen)
export const MendingDef: BuffDef = {
  id: BuffID.Mending,
  name: 'Mending',
  description: 'Regenerate 5 HP/sec',
  appliesTo: [BuffHostID.Player],
  isDebuff: false,
  stacking: false,
  color: 0x34eb49,
  stats: [{ stat: BuffStatID.LifeRegen, value: 5, isMultiplier: false }],
}

export class Mending extends Buff {}
```

### The flag pattern

Same rule as upgrades ([UPGRADES.md](UPGRADES.md#the-flag-pattern-allowed-coupling)): other files may ask **whether** a buff is active, but its numbers and behavior belong to the buff file. If the reaction differs per entity class, each affected class checks in its own override. Never in generic infrastructure like `CollisionManager`.

## HUD

Only the player's buffs are shown; enemy buffs show through tint, particles and draw hooks.

- **Data:** `GamePage` polls `request-buff-state` every 100 ms (with the ability poll). `MainScene` answers `buff-state-update` with `player.buffs.snapshot()` plus the held between-wave bundle buffs: `BuffSlotState[]` of `{ id, msLeft, stats, pending? }`, where `stats` are the values this application uses (overrides included). `hidden` buffs are skipped. A `pending` slot hasn't started yet; its `msLeft` is the full duration it will get.
- **Order** (`sortBuffs` in `BuffBar.tsx`, used by both views): active before pending, then debuffs first, then highest rarity, then name.
- **Pending buffs** show dimmed, with "next" instead of a countdown on the bar, and "next wave" under the time in `ViewBuffs`.
- **`BuffBar`** (`components/BuffBar.tsx`): a row of chips at bottom center. Each chip is the buff's icon in its `color` on a tinted square, outlined green (buff) or red (debuff), with the time left underneath; it pulses in the last 3 s. As many chips as fit the measured width are shown, the rest collapse into `+N`. Desktop: hover a chip for name, description and time.
  - Mobile placement comes from `buffBarBounds()` in `core/TouchLayout.ts`: under the joysticks on tall screens, between their touch areas on short ones. Desktop: the middle half of the screen.
  - Tapping the bar pauses the game and opens the pause menu on `ViewBuffs`. BACK returns to the pause menu.
- **`ViewBuffs`** (`components/ViewBuffs.tsx`): every active buff grouped into debuffs and buffs, with description, current stat values and time left. Also reachable from the pause menu's **VIEW BUFFS** button.
- **Icons:** `icon: IconID.X` on the def; `components/GameIcon.tsx` maps each `IconID` to what is drawn. To add one: a member in `IconID` (`data/ID.ts`), an entry in `GameIcon`'s `ICONS`. Defs store the id rather than a component so they stay JSON-serializable for the backend sync scripts. The current icons are `react-icons/gi` placeholders (CC BY 3.0, need attribution if shipped).

## Bundle drops

Upgrade bundles can roll buffs. Roll rules are in [UPGRADE_BUNDLE.md](UPGRADE_BUNDLE.md#step-by-step-offlinesandbox).

- **Who rolls:** offline/sandbox, `MainScene` rolls locally via `rollDrop`. Online, the server rolls the buff **and** its values (`collect_upgrade_bundle`) and the client applies exactly what `/waves/bundle-pickup` returns (`AddBuff(buff, duration, { stats })`). It never rolls locally
- **Online-grantable buffs:** every debuff, plus Mending, Toughness 1/2, Haste 1–3 and Frenzy (`WaveService.ONLINE_SAFE_BUFFS`). Damage and DoT buffs stay offline-only until damage validation is buff-aware (buff plan step 3), since today's checks would flag honest players who had them. A positive slot whose tier has no online-safe buff grants nothing
- **Whitelist:** `buffs/bundleDrops.ts` → `BUNDLE_BUFF_DROPS`. A buff only drops if it has an entry there. New buffs are **not** added automatically
- **Duration:** each entry rolls uniformly between its `minDuration` and `maxDuration` (ms), defaulting to `DEFAULT_DROP_MIN_DURATION` / `DEFAULT_DROP_MAX_DURATION` (5–10 s). These are separate from the def's `maxDuration`, which is the stacking cap and still clips the result
- **Custom rolls:** an entry can set `roll(drop, ctx)` returning `{ buff, duration, stats? }`, e.g. to scale a buff's duration or stats with the wave. There's no global scaling formula; each entry decides. `ctx` is `{ wave, difficultyId, upgrades }`, the only things the server also knows, so no live game state. Every `roll` must be hand-ported to `backend/app/core/buff_rolls.py` → `ROLLS` (keyed by BuffID), like `Normal.ts` → `difficulty/normal.py`. `sync-check.sh` fails on an entry with a `roll` but no port. A port that drifts only makes online and offline feel different. It can't cause a false flag, because validation reads the server's own rolled values
- **Rarity:** the drop's def `rarity` is matched against the rolled tier, walking down tiers like `pickCurse`. Debuffs also need `Player` in `appliesTo`
- **Between waves:** a buff from a bundle picked up while no wave is active is **held** (`MainScene.pendingBundleBuffs`) and applied on `wave-start`, with "(next wave)" on its pickup text. `stepLogic`, and so every buff timer, keeps running through the wave-complete screen and the shop, so applying it right away would let it run out there (and DoT debuffs would hurt in the shop). Held buffs are dropped on death
- **Server ledger:** each online grant is stored on the wave token's `bundle_buffs` as `{ id, granted_frame, duration_ticks, stats, queued }`. `granted_frame` is the client's wave-validation frame counter (ticks since the token was issued, not since the wave started; the counter keeps running through the shop), capped at the ticks that can have passed since token issue. `queued` marks a between-wave pickup (`offer_open`), whose window starts at the wave's start frame instead. The client reports that frame as `wave_start_frame` with `/waves/complete` (`WaveValidation.markWaveStart`, called from `WaveManager.startNextWave`), and the server bounds it
- **Buff-aware validation:** `backend/app/services/buff_timeline.py` → `BuffTimeline` rebuilds each grant's window from the ledger with `BuffContainer.add`'s rules (stacking, `maxDuration`, larger-magnitude stats), and `apply(stat, base, frame_from, frame_to)` returns the highest value a stat reaches in a frame range, with `BuffStats.apply`'s formula. Only positive values count. A mid-wave grant's window ends a little later, because the client only applies it when the pickup response arrives. Movement asks for `moveSpeed` per sample interval, and fire rate asks for `fireRate` between two shots (`shot_frames`, sent alongside the ms `shots_fired`). Speed and gaps stay in ms, since physics and the fire cooldown run on real time; frames only place things on the timeline

## Debugging

DevTools → **BUFFS** tab: set a duration, click **PLAYER** or **ENEMIES** (every live enemy) to apply, right-click a row to clear that buff everywhere.

## Not yet implemented

Tracked in the buff plan (`handoffs/2026-10-09-buff-system-server-design.md`, steps 2–3): buff-aware damage validation, damage buckets per buff signature, and DoT tracking. Movement and fire rate already read the `BuffTimeline`. `Projectile.getOwner()` was deferred from phase 3; nothing needs it yet.

Until validation knows about buffs:
- **damage-over-time damage is not reported as `damage-dealt`**, and `damage-dealt` reports the hit before enemy `DamageTaken` (Vulnerable) is applied. DoT kills still count, so enough of them can trip the "damage suspiciously low" floor;
- Wrath, Burning Bullets and Poison Tipped Rounds would get an online wave flagged, which is why the server doesn't grant them yet (see Bundle drops). Any buff applied through DevTools online isn't on the server's ledger, so a speed or fire-rate buff from there can flag too.