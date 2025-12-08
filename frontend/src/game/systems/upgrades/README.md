# Upgrade System

A data-driven, modular upgrade system that supports stat modifiers, projectile variants, effects, visual effects, and abilities.

## Architecture

### Core Systems

1. **UpgradeSystem** - Main manager that tracks and applies upgrades
2. **UpgradeModifierSystem** - Handles stat modifications (additive & multiplicative)
3. **UpgradeEffectSystem** - Manages gameplay effects (lifesteal, regen, etc.)
4. **EffectHandlers** - Implementations of all effects

### File Structure

```
systems/upgrades/
├── UpgradeSystem.ts          # Main upgrade manager
├── UpgradeModifierSystem.ts  # Stat modifier manager
├── UpgradeEffectSystem.ts    # Effect manager
├── EffectHandlers.ts         # Effect implementations
├── index.ts                  # Exports
└── README.md                 # This file

data/upgrades/
├── stat_upgrades.json        # Stat modifiers (+damage, +speed, etc.)
├── effect_upgrades.json      # Effects (lifesteal, regen, multishot, etc.)
├── variant_upgrades.json     # Projectile variants (homing, explosive, etc.)
├── visual_upgrades.json      # Visual effects (glow, trail, etc.)
└── ability_upgrades.json     # Abilities (dash, shield, time slow, etc.)
```

## Upgrade Types

### 1. Stat Modifiers
Modify numeric stats on entities.

**Example:**
```json
{
  "id": "bullet_damage_1",
  "name": "Sharper Rounds",
  "description": "+5 bullet damage",
  "rarity": "common",
  "type": "stat_modifier",
  "target": "bullet",
  "stat": "damage",
  "value": 5,
  "stackable": true,
  "maxStacks": 99
}
```

**Targets:**
- `bullet`, `laser`, `zapper`, `flamer`, `spinner` - Projectile types
- `player` - Player stats
- `triangle`, `square`, `pentagon`, etc. - Enemy types
- `enemy` - All enemies
- `wave` - Wave configuration

**Common Stats:**
- `damage`, `speed`, `pierce`, `size` - Projectiles
- `maxHealth`, `speed`, `polygonSides` - Player
- `health`, `damage`, `speed` - Enemies

### 2. Variant Upgrades
Replace a projectile class with a different variant.

**Example:**
```json
{
  "id": "homing_bullets",
  "name": "Homing Bullets",
  "description": "Bullets track nearest enemy",
  "rarity": "epic",
  "type": "variant",
  "target": "bullet",
  "variantClass": "HomingBullet",
  "replaces": ["explosive_bullets", "heavy_bullets"],
  "stackable": false
}
```

**Available Variants:**
- `HomingBullet` - Tracks enemies
- `ExplosiveBullet` - Explodes on impact
- `HeavyBullet` - Slower, more damage, more pierce

### 3. Effect Upgrades
Add behaviors that trigger on events.

**Example:**
```json
{
  "id": "vampirism_common",
  "name": "Vampirism",
  "description": "Heal for 2% of damage dealt",
  "rarity": "rare",
  "type": "effect",
  "effect": "lifesteal",
  "effectValue": 0.02,
  "stackable": true,
  "maxStacks": 5
}
```

**Effect Events:**
- `onHit` - When projectile hits enemy
- `onKill` - When enemy is killed
- `onUpdate` - Every frame
- `onDamage` - When player takes damage
- `onSpawn` - When entity spawns

**Built-in Effects:**
- `lifesteal` - Heal on hit
- `regen` - Heal over time
- `armor` - Reduce incoming damage
- `thorns` - Reflect damage
- `explode_on_kill` - Enemies explode on death
- `multishot` - Fire additional projectiles

### 4. Visual Effects
Add visual enhancements.

**Example:**
```json
{
  "id": "player_glow",
  "name": "Radiant Core",
  "description": "Player emits a glowing aura",
  "rarity": "uncommon",
  "type": "visual_effect",
  "target": "player",
  "effect": "glow",
  "value": 0x00ffff,
  "stackable": false
}
```

### 5. Ability Upgrades
Unlock new player abilities.

**Example:**
```json
{
  "id": "dash_ability",
  "name": "Dash",
  "description": "Press SPACE to dash",
  "rarity": "epic",
  "type": "ability",
  "effect": "dash",
  "stackable": false
}
```

## Usage

### Applying an Upgrade

```typescript
import { UpgradeSystem } from './systems/upgrades'

// Load upgrade from JSON
const upgrade = statUpgrades.upgrades.find(u => u.id === 'bullet_damage_1')

// Apply it
UpgradeSystem.applyUpgrade(upgrade)
```

### Checking Active Upgrades

```typescript
// Check if variant is active
const variant = UpgradeSystem.getVariant('bullet') // 'HomingBullet' | null

// Check if effect is active
if (UpgradeSystem.hasEffect('lifesteal')) {
  const percent = UpgradeSystem.getEffectValue('lifesteal') // 0.02
}

// Get stat modifiers
const modifiers = UpgradeSystem.getModifiers('bullet')
const damageBonus = modifiers.get('damage') // +15 from upgrades
```

### Creating Projectiles with Modifiers

```typescript
// In Player.ts
const projectile = new Bullet()
projectile.SetDefaults()

// Apply modifiers
const modifiers = UpgradeSystem.getModifiers('bullet')
for (const [stat, value] of modifiers) {
  if (stat in projectile) {
    projectile[stat] += value
  }
}

projectile._spawn(...)
```

### Triggering Effects

```typescript
// In CollisionManager.ts
UpgradeEffectSystem.onProjectileHit(projectile, enemy)
UpgradeEffectSystem.onEnemyKill(enemy)

// In MainScene.ts update()
UpgradeEffectSystem.onUpdate(delta)

// In Player.ts takeDamage()
const modifiedDamage = UpgradeEffectSystem.onPlayerDamage(amount)
```

## Adding New Upgrades

### 1. Stat Modifier
Just add to the appropriate JSON file:

```json
{
  "id": "laser_damage_2",
  "name": "Focused Beam II",
  "description": "+30 laser damage",
  "rarity": "rare",
  "type": "stat_modifier",
  "target": "laser",
  "stat": "damage",
  "value": 30,
  "stackable": true,
  "maxStacks": 10
}
```

No code changes needed!

### 2. New Effect
1. Add to effect_upgrades.json
2. Register handler in EffectHandlers.ts:

```typescript
UpgradeEffectSystem.registerEffect('poison', {
  onHit: (projectile, enemy) => {
    const dps = UpgradeEffectSystem.getEffectValue('poison')
    enemy.applyPoison(dps, 3000) // 3 seconds
  }
})
```

### 3. New Variant
1. Create projectile class:
```typescript
export class PiercingBullet extends Projectile {
  SetDefaults() {
    this.damage = 8
    this.speed = 500
    this.pierce = 999 // Infinite pierce
    this.color = 0x00ff00
  }
}
```

2. Add to variant_upgrades.json:
```json
{
  "id": "piercing_bullets",
  "name": "Piercing Bullets",
  "variantClass": "PiercingBullet",
  ...
}
```

3. Add to Player.ts createBulletVariant():
```typescript
case 'PiercingBullet':
  return new PiercingBullet()
```

## Upgrade Tiers

Upgrades can have multiple tiers:

```json
{
  "id": "vampirism_common",
  "tier": 1,
  "upgradesTo": "vampirism_epic",
  ...
},
{
  "id": "vampirism_epic",
  "tier": 2,
  "upgradesTo": "vampirism_legendary",
  ...
}
```

## Stack Limits

Control how many times an upgrade can be applied:

```json
{
  "stackable": true,
  "maxStacks": 5  // Can get this upgrade 5 times max
}
```

## Rarity System

- `common` - Basic upgrades
- `uncommon` - Moderate power
- `rare` - Strong upgrades
- `epic` - Very powerful
- `legendary` - Game-changing

## Future Extensions

### Enemy Modifiers
Apply upgrades to enemies:

```json
{
  "id": "stronger_triangles",
  "type": "stat_modifier",
  "target": "triangle",
  "stat": "health",
  "value": 20
}
```

### Wave Modifiers
Change wave behavior:

```json
{
  "id": "more_enemies",
  "type": "stat_modifier",
  "target": "wave",
  "stat": "enemyCount",
  "value": 1.5,
  "isMultiplier": true
}
```

### Boss Modifiers
Future boss-specific upgrades:

```json
{
  "id": "boss_damage",
  "type": "stat_modifier",
  "target": "boss",
  "stat": "damage",
  "value": 50
}
```
