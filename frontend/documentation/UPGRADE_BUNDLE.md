# Upgrade Bundle System

Enemies drop collectible in-world upgrade bundles on death. The player walks over them mid-combat to receive one or more upgrades (and possibly curses) immediately, bypassing the post-wave modal.

---

## Files

| File | Role |
|------|------|
| `src/game/entities/upgrades/DroppedUpgradeBundle.ts` | Renderable in-world pickup. Handles its own visuals, physics body, fade/expiry. |
| `src/game/entities/enemies/Enemy.ts` | Base class owns `bundleDropChance`, `bundleDropMin`, `bundleDropMax`, `dropBundle()`, `DropBundles()`. |
| `src/game/entities/enemies/Dodecahedron.ts` | Only enemy that currently overrides `DropBundles()` — guarantees a legendary on boss death. |
| `src/game/systems/CollisionManager.ts` | Calls `enemy.DropBundles()` on every projectile kill. |
| `src/game/systems/WaveManager.ts` | Exposes `getBundleDropChance()`, `getBundleRarityWeights()`, `getRarityWeights()` as passthroughs to the Difficulty. |
| `src/game/systems/difficulty/Difficulty.ts` | Interface — declares `getBundleDropChance(wave)` and `getBundleRarityWeights(wave)`. |
| `src/game/systems/difficulty/Normal.ts` | Implements both methods with per-wave tables (`BUNDLE_RARITY_WEIGHTS_BY_WAVE`, `getBundleDropChance`). |
| `src/game/systems/upgrades/UpgradeSystem.ts` | `UpgradeDefinition` interface includes `curse?: boolean`. `canApply()` used by item pickers. |
| `src/game/systems/upgrades/UpgradeModifierSystem.ts` | `addModifier()` has a curse guard for additive modifiers to prevent going below 0. |
| `src/game/core/EventBus.ts` | `'upgrade-bundle'` event type: `{ x, y, bundleDropChance, forcedRarity? }`. |
| `src/game/scenes/MainScene.ts` | Bundle group, player-bundle overlap handler, item roll logic, pickup text, `_update()` tick. |
| `src/game/data/ID.ts` | `const enum BundleRarity { Common=0, Uncommon=1, Rare=2, Epic=3, Legendary=4 }`. |
| `src/game/data/upgrades/curses.json` | 5 Weakness curses (common → legendary). The only curse pool that exists right now. |

---

## Architecture — Call Chain

```
Enemy dies (projectile kill)
  → CollisionManager.handleProjectileEnemyCollision()
      → enemy.DropBundles()                         // virtual — subclasses override
          → this.dropBundle(forcedRarity?, offsetX, offsetY)   // protected helper on Enemy
              → EventBus.emit('upgrade-bundle', { x, y, bundleDropChance, forcedRarity? })

MainScene (registered once in create())
  → listens for 'upgrade-bundle'
      → if forcedRarity is set: skip drop-chance roll + rarity roll, spawn immediately
      → else: roll drop chance, roll rarity via rollBundleRarity(), spawn DroppedUpgradeBundle
      → push to activeBundles[], add container to bundleGroup

Player overlaps bundle (Phaser overlap, registered in create())
  → bundle.destroy() called immediately to prevent double-pickup
  → roll count (1–4 items)
  → build capped + re-normalized rarity weights for this bundle's tier
  → slot 1: pickRegularUpgrade(upgradeValue, exclude)        // guaranteed matching-tier item
  → slots 2–N: 50/50 → pickCurse(rollItemRarity()) or pickRegularUpgrade(rollItemRarity())
  → applyUpgrade(id, true) for each picked id
  → showBundlePickupText() for each (staggered 220 ms apart)

MainScene._update()
  → iterates activeBundles[], calls bundle._update()
  → prunes destroyed bundles from the array
```

---

## Enemy Drop Configuration

Three fields on `Enemy` (base class defaults):

```typescript
bundleDropChance: number = 0    // 0 = use difficulty; >0 overrides per-enemy (1.0 = guaranteed)
bundleDropMin: number = 1       // min bundles emitted on death
bundleDropMax: number = 1       // max bundles emitted on death
```

`DropBundles()` picks a count in `[bundleDropMin, bundleDropMax]` and calls `dropBundle()` that many times, with random scatter when count > 1.

### How to customize drops on a new enemy

```typescript
// Option A — just change count (no override needed):
SetDefaults(): void {
  this.bundleDropMin = 3
  this.bundleDropMax = 6
}

// Option B — force specific rarities (requires override):
import { BundleRarity } from '../../data/ID'

DropBundles(): void {
  this.dropBundle(BundleRarity.Legendary)           // guaranteed legendary
  this.dropBundle(BundleRarity.Rare, 20, -10)      // rare, offset right/up
  this.dropBundle()                                 // random rarity via normal roll
}
```

`dropBundle()` is `protected` — subclasses never touch `EventBus` directly.

### Current enemy overrides

| Enemy | Override | Behavior |
|-------|----------|----------|
| `Dodecahedron` (boss) | `DropBundles()` | `dropBundle(BundleRarity.Legendary)` — one guaranteed legendary |
| All others | none | default: 1 bundle per kill, drop chance + rarity from Difficulty |

---

## Drop Chance (Normal Difficulty)

Defined in `Normal.ts → getBundleDropChance(wave)`:

| Wave range | Per-kill drop chance |
|------------|----------------------|
| 1–4        | 50% *(wave 1 is generous for early feel)* |
| 5–9        | 7% |
| 10–14      | 9% |
| 15–19      | 10% |
| 20+        | 12% |

If `enemy.bundleDropChance > 0` the per-enemy value takes precedence over the difficulty's value.  
`forcedRarity` bypasses the drop-chance roll entirely.

---

## Bundle Rarity Weights (Normal Difficulty)

Defined in `BUNDLE_RARITY_WEIGHTS_BY_WAVE` in `Normal.ts`. More common-heavy than the post-wave modal weights because bundles are mid-combat bonus loot. Waves 1–20 have explicit tables; wave 21+ uses the fallback:

```
Fallback: { common: 0.33, uncommon: 0.36, rare: 0.20, epic: 0.08, legendary: 0.03 }
```

Legendary weight is 0.0 until wave 11.

---

## DroppedUpgradeBundle Visual

Layered rotating polygons. Number of color layers = `upgradeValue + 1`, rendered outer → inner so the triangle is always on top.

| Rarity | upgradeValue | Layers (outer → inner) |
|--------|-------------|------------------------|
| Common | 0 | triangle *(+ a faint white triangle behind it for visibility)* |
| Uncommon | 1 | square → triangle |
| Rare | 2 | pentagon → square → triangle |
| Epic | 3 | hexagon → pentagon → square → triangle |
| Legendary | 4 | septagon → hexagon → pentagon → square → triangle *(+ white triangle on top for visibility)* |

Rarity colors: `#aaaaaa / #44cc66 / #4488ff / #cc44ff / #ffaa00`

- Outer layers are larger, more transparent, and rotate slower.
- Sprites use `BlendMode.ADD`.
- Rotation is applied via `sprite.setRotation()` every `_update()` — never baked into the texture key (that would flood the texture cache).
- Hitbox: circle with `radius = size + 4` (currently `size = 9`, so radius 13).
- Lifespan: 30 000 frame ticks (≈ 500 s at 60 fps). Fades out over the last 180 ticks (≈ 3 s).

---

## Item Selection — What's In The Bundle

Happens **at collection time**, not spawn time, so `canApply()` reflects live upgrade state.

### Step-by-step

1. **Roll count** — `Math.floor(Math.random() * 4) + 1` → 1, 2, 3, or 4 items.
2. **Build capped rarity weights** — take the wave's `getRarityWeights()`, sum only the tiers ≤ `upgradeValue`, and use that sum as the random ceiling. This redistributes probability from higher tiers into the eligible range.
   - *Example:* rare bundle (tier 2) on wave 25 with weights `[0.22, 0.36, 0.30, 0.09, 0.03]`. Eligible sum = 0.88. Roll lands on common ~25%, uncommon ~41%, rare ~34%.
3. **Slot 1 (`pickRegularUpgrade(upgradeValue, exclude)`)** — always a regular upgrade at the bundle's exact tier (with tier-by-tier fallback if the pool is exhausted). Guarantees every bundle has at least one non-curse item matching its tier.
4. **Slots 2–N** — each independently 50/50: `pickCurse(rollItemRarity(), exclude)` or `pickRegularUpgrade(rollItemRarity(), exclude)`. The exclude list grows with each pick to prevent duplicates.
5. **Apply all** — `applyUpgrade(id, true)` for each picked id (`true` = skip cost, no `waveValidation.selectUpgrade()` call).
6. **Show pickup text** — `showBundlePickupText()` called once per item, staggered 220 ms apart. Curses appear in red; regular items in their rarity color.

### pickRegularUpgrade()

Looks across `statUpgrades`, `effectUpgrades`, `variantUpgrades`, `visualUpgrades`, `abilityUpgrades`. Filters by rarity, then checks `UpgradeSystem.canApply()`. Additionally blocks variant upgrades whose `variantClass` differs from the currently-active variant on the same `target` — bundles must not silently swap your bullet type.

### pickCurse()

Looks in `curses.json` only. Filters by rarity, then checks `UpgradeSystem.canApply()`.

---

## Curses (`curses.json`)

Currently 5 Weakness curses — one per rarity tier. Each is a multiplicative damage reduction on the `attack` target.

| ID | Name | Rarity | Value |
|----|------|--------|-------|
| `damage_reduc_1` | Weakness 1 | common | -0.1% damage |
| `damage_reduc_2` | Weakness 2 | uncommon | -0.4% damage |
| `damage_reduc_3` | Weakness 3 | rare | -0.8% damage |
| `damage_reduc_4` | Weakness 4 | epic | -1.75% damage |
| `damage_reduc_5` | Weakness 5 | legendary | -3.75% damage |

All use `isMultiplier: true` and `stackable: true` with `maxStacks: 99999`. They accumulate in `UpgradeModifierSystem`'s `multiplicativeModifiers` map and reduce the final stat via `(base + additive) * (1 + multiplicative)`.

---

## Curse Flow — End to End

```
curses.json
  → imported in MainScene.ts alongside stat/effect/variant/visual/ability JSONs
  → pickCurse() filters curses.curses[] by rarity + canApply()
  → applyUpgrade(id, true)
      → MainScene calls UpgradeSystem.apply(def)
          → applyStatModifier(def)
              → UpgradeModifierSystem.addModifier(target, stat, value, isMultiplier=true, curse=true)
                  → multiplicativeModifiers[target][stat] += value  (value is negative)
  → Bullet/stat reads:
      UpgradeModifierSystem.getMultiplicativeModifier('attack', 'damage')
          → multiplied into final damage in the projectile or damage formula
```

The `curse` flag in `addModifier` only guards additive modifiers (clamps at 0/1 to prevent negative base values). All current curses are multiplicative, so the guard is never exercised in practice.

---

## `ID.ts` — Named Constants

`src/game/data/ID.ts` is modeled after Terraria's `Terraria.ID` pattern. Currently holds only `BundleRarity`:

```typescript
export const enum BundleRarity {
  Common    = 0,
  Uncommon  = 1,
  Rare      = 2,
  Epic      = 3,
  Legendary = 4,
}
```

`const enum` values are inlined at compile time — `BundleRarity.Legendary` compiles to the literal `4`. Do not re-export through barrel `index.ts` files; import directly from `data/ID.ts`.

---

## Key Design Decisions

**Item selection happens at collection time, not spawn time.**
If the upgrade were selected at spawn, it could become invalid before pickup (e.g. a ricochet bundle spawns when you have 1/2 stacks, you pick another ricochet from the modal, and the bundle would now overflow the cap). `pickRegularUpgrade()` / `pickCurse()` run fresh on overlap, calling `UpgradeSystem.canApply()` against live state.

**Variants that would replace an active variant are excluded from bundle rolls.**
`canApply()` does not block variant swaps because the post-wave modal lets players intentionally switch bullet types. Bundles are silent auto-applies, so `pickRegularUpgrade()` adds an extra guard: if a variant's `variantClass` differs from the currently active variant on the same `target`, it's excluded.

**Slot 1 is structurally forced to `pickRegularUpgrade(upgradeValue)`.**
This guarantees every bundle contains exactly one item at the bundle's tier. It's simpler than rolling all slots and re-rolling if all come up curse — no retry loop, deterministic count.

**Capped + normalized weights instead of a hard tier fallback.**
The old implementation (`pickUpgradeForRarity`) tried `maxRarity` then fell back tier-by-tier until it found something. That biased rare bundles toward always yielding rare items. The current roller samples from the full wave distribution capped at the bundle's tier; `pickRegularUpgrade` / `pickCurse` still have a tier fallback, but only for pool-exhaustion edge cases.

**Rarity guarantee fix (2026-06-29):** Slot 1 originally called `pickRegularUpgrade(rollItemRarity(), ...)` — the roller could sample a lower tier than the bundle's own tier. Fixed by passing `upgradeValue` directly as the max rarity for slot 1.

**`forcedRarity` bypasses both the drop-chance roll and the rarity roll.**
A forced rarity implies a guaranteed spawn. If you want a forced rarity that still respects drop chance, handle the coin flip inside `DropBundles()` before calling `dropBundle()`.

**Bundle drops only trigger from projectile kills.**
`enemy.DropBundles()` is called in `CollisionManager.handleProjectileEnemyCollision`. Enemies killed by explosion AoE (via the `'explosion-damage'` event in MainScene) do not trigger bundle drops.

---

## Known Issues / Follow-up Work

- **Backend sync gap.** `applyUpgrade(id, true)` skips `waveValidation.selectUpgrade()`. Bundle-applied upgrades go into `GameManager.appliedUpgrades` locally but are not validated server-side. This could be a desync vector if backend validation is strict.
- **`replaces` field type mismatch.** In `variant_upgrades.json`, `replaces` is typed as `string[]` in `UpgradeDefinition` but stored as a plain string in the JSON. `applyVariant()` does `for...of` on it, which iterates characters rather than IDs. The variant swap logic in the post-wave modal is effectively broken but unnoticed because both upgrades overwrite `activeVariants` by target anyway.
- **Only one curse type exists.** `curses.json` has only Weakness (damage reduction). Future curses using additive values would exercise the `UpgradeModifierSystem.addModifier` curse guard that currently has no real callers.
- **"Show highest rarity" on bundle visual** — the bundle's visual rarity is set at spawn (before items are rolled). This is effectively correct since `upgradeValue` IS the cap for item rarity, but revisit if multi-rarity bundles with items above the visual tier are ever added.