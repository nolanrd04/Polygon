# Upgrades System

Upgrades are positive modifications that enhance player capabilities during gameplay. They range from simple stat increases to complex interactive effects and variant weapon changes.

## Overview

- **Data Location**: `frontend/src/game/data/upgrades/` (organized by type)
- **Implementation**: `frontend/src/game/systems/upgrades/` (4-file system coordinated by `UpgradeSystem`)
- **Application**: Applied through a centralized system that validates, tracks, and delegates by type
- **Types**: Five distinct types — stat modifier, effect, ability, variant, visual effect
- **Coordination**: `UpgradeSystem` routes each upgrade to the appropriate sub-system

## Important Files

### Data Files (JSON)

| File | Purpose | Example Content |
|------|---------|-----------------|
| `stat_upgrades.json` | Flat numeric modifiers (damage, speed, health) | `+0.8% damage`, `-20 max health` |
| `effect_upgrades.json` | Interactive effects (lifesteal, regen, thorns, explosions) | Heal on hit, damage reduction, reflect |
| `ability_upgrades.json` | Player abilities (dash, shield, time slow) | Toggleable/triggered actions |
| `variant_upgrades.json` | Weapon variant swaps (replaces one variant with another) | Homing bullets, explosive bullets |
| `visual_upgrades.json` | Cosmetic visual effects (glows, trails, particles) | Radiant aura, projectile trails |
| `curses.json` | Negative upgrades (debuffs) | See [CURSES.md](./CURSES.md) |

### Implementation Files

| File | Responsibility |
|------|-----------------|
| `UpgradeSystem.ts` | Central coordinator — validates, applies, tracks all upgrades by type |
| `UpgradeModifierSystem.ts` | Numeric stat calculations (formula: `(base + additive) × (1 + multiplicative)`) |
| `UpgradeEffectSystem.ts` | Non-numeric effects (lifesteal on hit, regen per frame, damage reduction, reflect) |
| `EffectHandlers.ts` | Concrete behavior for each effect (registered once at game start in `MainScene.create()`) |

## Upgrade Structure

All upgrades follow this base structure:

```json
{
  "id": "upgrade_identifier",
  "name": "Display Name",
  "description": "Brief description",
  "rarity": "rare",
  "type": "stat_modifier|effect|ability|variant|visual_effect",
  "stackable": true,
  "maxStacks": 5,
  "cost": 10
}
```

### Type-Specific Fields

#### Stat Modifier
Used for numeric stat changes (additive or multiplicative).

```json
{
  "type": "stat_modifier",
  "target": "attack",
  "stat": "damage",
  "value": 0.008,
  "isMultiplier": true
}
```

- **target**: Entity type affected — `"attack"`, `"bullet"`, `"player"`, `"laser"`, `"spinner"`, etc.
- **stat**: Specific stat to modify — `"damage"`, `"speed"`, `"maxHealth"`, `"fireRate"`, etc.
- **value**: Numeric change (can be positive or negative)
- **isMultiplier**: `true` = multiplicative (stacks additively as percentages), `false` = additive flat value

#### Effect
Triggers custom behavior on game events (hit, kill, damage taken, frame update).

```json
{
  "type": "effect",
  "effect": "lifesteal",
  "effectValue": 0.02,
  "stackable": true,
  "maxStacks": 3
}
```

- **effect**: Registered effect ID from `EffectHandlers.ts`
- **effectValue**: Numeric parameter (e.g., percentage, damage amount, healing rate)
- If stackable, effect values accumulate

**Available effects** (registered in `EffectHandlers.ts`):
| Effect ID | Trigger | Behavior |
|-----------|---------|----------|
| `lifesteal` | `onHit` | Heal player for `projectile.damage × lifeStealPercent` |
| `regen` | `onUpdate` | Heal player each frame based on HP/sec |
| `protection` | `onDamage` | Reduce incoming damage by percentage |
| `thorns` | `onDamage` | Reflect percentage of damage back to nearby enemies |
| `explode_on_kill` | `onKill` | Emit explosion event at enemy death location |
| `dash` | — | Tracked ability; behavior in `Player.ts` |
| `shield` | — | Tracked as consumable shield charge |

#### Ability
Grants a player ability (dash, shield, time slow). Often has dependencies.

```json
{
  "type": "ability",
  "effect": "dash",
  "stackable": false,
  "dependentOn": [],
  "cost": 10
}
```

- **effect**: Ability ID (linked to handlers or tracked via `hasAbility('id')`)
- Typically `stackable: false` unless ability charges/stacks (e.g., shield charges)

#### Variant
Swaps one weapon variant for another. Mutually exclusive.

```json
{
  "type": "variant",
  "target": "bullet",
  "attackType": "bullet",
  "variantClass": "HomingBullet",
  "replaces": ["explosive_bullets"],
  "stackable": false,
  "cost": 20
}
```

- **target**: Entity type being replaced (e.g., `"bullet"`, `"laser"`)
- **variantClass**: Class name of the new variant (must be implemented in codebase)
- **replaces**: Array of variant IDs this replaces (mutual exclusivity)
- **attackType**: *(Optional)* Restricts to specific attack type (e.g., `"bullet"` only)

#### Visual Effect
Cosmetic only — no gameplay impact.

```json
{
  "type": "visual_effect",
  "target": "player",
  "effect": "glow",
  "color": 65535,
  "intensity": 0.5,
  "stackable": false,
  "cost": 0
}
```

- **target**: Entity affected (e.g., `"player"`, `"bullet"`)
- **effect**: Visual effect ID
- Additional fields (color, intensity, etc.) depend on the effect handler

## Core Concepts

### Stacking

Upgrades can be stackable or singleton.

- **Stackable** (`"stackable": true`): Can be applied multiple times (up to `maxStacks`)
  - Stat modifiers: Values accumulate
  - Effects: Numeric values accumulate (e.g., 5% lifesteal + 5% lifesteal = 10% total)
  - Tracked via `UpgradeSystem.getStackCount(upgradeId)`

- **Non-stackable** (`"stackable": false`): Can only be applied once
  - Abilities, variants, tier upgrades, and most special effects

### Tiers and Upgrades

Linear progression through tiers using `upgradesTo`:

```json
{
  "id": "vampirism_1",
  "tier": 1,
  "upgradesTo": "vampirism_2",
  ...
},
{
  "id": "vampirism_2",
  "tier": 2,
  "upgradesTo": "vampirism_3",
  ...
},
{
  "id": "vampirism_3",
  "tier": 3,
  ...
}
```

Each tier upgrade is mutually exclusive with its siblings — you can only have one tier active at a time.

### Dependencies and Incompatibilities

Control upgrade availability and interactions.

**Dependencies** — upgrade requires other upgrades first:
```json
{
  "id": "triple_dash",
  "dependentOn": ["double_dash"],
  "dependencyCount": 1
}
```

- **dependentOn**: Array of upgrade IDs required
- **dependencyCount**: How many of the `dependentOn` upgrades must be owned (default: 1)
- Validation happens in `UpgradeSystem.canApply()`

**Incompatibilities** — upgrades cannot coexist:
```json
{
  "id": "homing_bullets",
  "incompatibleWith": ["explosive_bullets"]
}
```

- `UpgradeSystem` prevents applying an incompatible upgrade if any conflicting upgrade is active

### How Upgrades Are Applied

1. **Validation** (`UpgradeSystem.canApply()`)
   - Check stack limits
   - Check dependencies are met
   - Check no incompatibilities exist

2. **Delegation by type**
   - `stat_modifier` → `UpgradeModifierSystem.addModifier()`
   - `effect` → `UpgradeEffectSystem.addEffect()`
   - `ability` → `UpgradeEffectSystem.addAbility()`
   - `variant` → Update active variants, remove replaced ones
   - `visual_effect` → `UpgradeEffectSystem.addVisualEffect()`

3. **Tracking**
   - Store in `appliedUpgrades` map
   - Increment stack count
   - Emit `upgrade-applied` event for UI updates

### Modifier Formula

Applied by `UpgradeModifierSystem.applyModifiers()`:

```
finalValue = (baseValue + additive) × (1 + multiplicative)
```

Multiple multiplicative upgrades **sum**, not multiply:
- `5% + 5% + 5% = 15%` (not `15.76%`)

## Adding a New Upgrade

### 1. Choose the Right File and Type

- **Stat increase/decrease** → `stat_upgrades.json`, type `stat_modifier`
- **Interactive behavior** → `effect_upgrades.json`, type `effect`
- **Player ability** → `ability_upgrades.json`, type `ability`
- **Weapon variant** → `variant_upgrades.json`, type `variant`
- **Cosmetic effect** → `visual_upgrades.json`, type `visual_effect`
- **Negative effect** → `curses.json`, type varies, add `"curse": true`

### 2. Add the JSON Definition

Example: New stackable stat upgrade

```json
{
  "id": "critical_strike_1",
  "name": "Critical Strike",
  "description": "+1% critical hit chance",
  "rarity": "uncommon",
  "type": "stat_modifier",
  "target": "bullet",
  "stat": "critChance",
  "value": 0.01,
  "isMultiplier": false,
  "stackable": true,
  "maxStacks": 10,
  "cost": 5
}
```

Example: New effect upgrade with dependencies

```json
{
  "id": "ricochet_enhanced",
  "name": "Enhanced Ricochet",
  "description": "Ricochet bounces increase damage by 5%",
  "rarity": "rare",
  "type": "effect",
  "effect": "ricochet_boost",
  "effectValue": 0.05,
  "stackable": false,
  "dependentOn": ["ricochet"],
  "dependencyCount": 1,
  "cost": 15
}
```

### 3. If Adding a New Effect

Register the effect in `EffectHandlers.ts`:

```ts
// In registerEffectHandlers()
UpgradeEffectSystem.registerEffect('ricochet_boost', {
  onProjectileCollision: (projectile: any) => {
    // Custom behavior here
    const boostValue = UpgradeEffectSystem.getEffectValue('ricochet_boost')
    projectile.damage *= (1 + boostValue)
  }
})
```

Available event hooks:
- `onHit(projectile, enemy)` — when projectile hits enemy
- `onKill(enemy)` — when enemy dies
- `onUpdate(deltaTime)` — every frame
- `onDamage(amount)` — when player takes damage (can modify and return amount)
- `onSpawn(entity)` — when entity spawns

### 4. If Adding a New Variant

1. Implement the variant class (e.g., `HomingBullet.ts`)
2. Add to `variant_upgrades.json`:

```json
{
  "id": "my_variant",
  "type": "variant",
  "target": "bullet",
  "variantClass": "MyVariantClass",
  "replaces": ["other_variant"],
  "stackable": false
}
```

3. The system calls `UpgradeSystem.getVariant(target)` to get the active variant class name

### 5. If Adding a New Stat Target

Stat modifiers work on any `target` + `stat` combination. Ensure the code that uses the stat calls:

```ts
UpgradeModifierSystem.applyModifiers(target, stat, baseValue)
```

For example, if adding a new stat `"accuracy"` on `"bullet"` target, any code applying bullet stats would call:

```ts
const accuracy = UpgradeModifierSystem.applyModifiers('bullet', 'accuracy', baseAccuracy)
```

## Integration Points

### In Player Code

Query active effects and abilities:
```ts
UpgradeSystem.hasEffect('lifesteal')
UpgradeSystem.getEffectValue('lifesteal')
UpgradeSystem.hasAbility('dash')
UpgradeSystem.getVariant('bullet')
```

### In Collision/Damage Code

Apply modifiers before calculations:
```ts
const finalDamage = UpgradeModifierSystem.applyModifiers('bullet', 'damage', baseDamage)
```

Trigger effect events at appropriate moments:
```ts
UpgradeEffectSystem.onProjectileHit(projectile, enemy)
UpgradeEffectSystem.onEnemyKill(enemy)
UpgradeEffectSystem.onPlayerDamage(amount)
```

## Validation Rules

- **id**: Must be unique, lowercase with underscores
- **name**: Display name, can be shared across tiers
- **rarity**: One of `common`, `uncommon`, `rare`, `epic`, `legendary`
- **type**: Must match one of the five types
- **stackable**: Must be boolean
- For `stat_modifier`: Must have `target`, `stat`, `value`, `isMultiplier`
- For `effect`: Must have `effect` ID that is registered in `EffectHandlers.ts`
- For `variant`: Must have `target`, `variantClass`, and `replaces` array
- Dependencies and incompatibilities must reference valid upgrade IDs

## Bundle Pickup Flow

When a player collects an upgrade bundle, the following sequence executes (see `MainScene.ts` lines 108–175):

### 1. Bundle Overlap Detected
**MainScene.ts:108** — Phaser overlap handler registered in `create()`

### 2. Bundle Destroyed & Position Saved
**MainScene.ts:117** — `bundle.destroy()` called immediately to prevent double-pickup
- Saves bundle position for floating text display

### 3. Roll Item Count
**MainScene.ts:121** — `Math.floor(Math.random() * 4) + 1` yields 1–4 items per bundle

### 4. Build Rarity Weights
**MainScene.ts:123–136** — Rarity weights are capped and re-normalized to bundle tier
- Example: A rare bundle on wave 25 strips epic + legendary from the weight table
- Remaining rarities (common, uncommon, rare) are rescaled to sum to 1.0
- Creates `rollItemRarity()` closure for consistent rolls within this bundle

### 5. Pick Upgrades
**MainScene.ts:138–152** — Slots filled sequentially:

| Slot | Source | Logic |
|------|--------|-------|
| Slot 1 | `pickRegularUpgrade(upgradeValue)` | **Lines 749+** — Guaranteed matching-tier item; falls back to lower tiers only if pool exhausted |
| Slots 2–N | 30% curse / 70% upgrade | **Lines 148–152** — Each roll: 30% `pickCurse()`, 70% `pickRegularUpgrade()` at rolled rarity |

**Exclusion**: All picked IDs tracked in `pickedIds` array to prevent duplicates within bundle

**Validation**: Each candidate passes `UpgradeSystem.canApply()` (dependency, incompatibility, stack limit checks)

### 6. Apply & Display
**MainScene.ts:165–173** — For each picked upgrade:
- Call `applyUpgrade(upgradeId, true)`
- Look up upgrade definition
- Call `showBundlePickupText()` with 220ms stagger

### Helper Functions

**`pickCurse(maxRarity, exclude)` — Lines 734–746**
```ts
// Filters curses.curses by rarity tier (maxRarity down to 0)
// Falls back to lower tiers if none available at requested tier
// Skips IDs in exclude array
// Validates with UpgradeSystem.canApply()
```

**`pickRegularUpgrade(maxRarity, exclude)` — Lines 749+**
```ts
// Filters all non-curse upgrades (stat, effect, ability, variant, visual)
// Falls back to lower tiers
// Validates with UpgradeSystem.canApply()
// Special: Doesn't silently replace active variants
```

**`showBundlePickupText(x, y, upgradeName, rarityIndex, curse, delay)` — Lines 688–719**
```ts
// Creates floating text at bundle location
// Colors:
//   Rarity 0–4: gray, green, blue, purple, gold
//   Curse: red
// Tweens upward with alpha fade over 1800ms
// Delayed by 220ms per item (staggered display)
```

---

## Debugging

### Check Active Upgrades

```ts
console.log(UpgradeSystem.getAppliedUpgrades())
```

### Check Stack Count

```ts
console.log(UpgradeSystem.getStackCount('damage_1'))
```

### Check Modifiers

```ts
UpgradeModifierSystem.debug()
```

### Check Effect Values

```ts
console.log(UpgradeSystem.getEffectValue('lifesteal'))
```

## Known Issues & Best Practices

- **Stat modifier naming**: Use consistent naming across tiers (e.g., "Devastation" for all damage tiers)
- **Effect IDs**: Must match exactly in both JSON and `EffectHandlers.ts`
- **Variant replaces**: Array is symmetric — both directions must be listed
- **Cursor filtering**: Attack-type-specific upgrades (with `attackType` field) are filtered by the backend; frontend validates to prevent invalid selections
- **Bundle rarity normalization**: Weights are capped at bundle tier to ensure no epic/legendary items appear in common bundles
- **Duplicate prevention**: The `pickedIds` array prevents the same upgrade from appearing twice in one bundle
