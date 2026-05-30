# Data

Game data lives in `frontend/src/game/data/`.

---

## Attack Types

**File:** `attackTypes.ts`

Defines the `AttackType` union type and a `ATTACK_INFO` record used by the UI to display names and descriptions.

The five attack types are:

| ID | Name | Description |
|----|------|-------------|
| `bullet` | Bullet | Rapid-fire projectiles. Supports multishot, pierce, homing, explosive, and heavy variants. The only fully implemented attack type. |
| `laser` | Laser | Instant hitscan beam that pierces enemies. |
| `zapper` | Zapper | Chain lightning that jumps between nearby enemies. |
| `flamer` | Flamer | Continuous cone of fire for close-range crowd control. |
| `spinner` | Spinner | Deploys a spinning blade hitbox around the player. |

The attack type is selected on `AttackSelectPage` and stored in `sessionStorage`. `MainScene` passes it to the `Player` constructor.

---

## Upgrade JSON Files

All upgrade definitions live in `frontend/src/game/data/upgrades/`. They are imported directly by `MainScene`, `WaveValidation`, and the backend. The JSON files are not a complete registry to memorise — instead, understand what each file is responsible for:

### `stat_upgrades.json` — Fixed stat modifiers

These upgrades directly change a numeric stat on a target. Every entry specifies a `target` (e.g. `"bullet"`, `"player"`), a `stat` (e.g. `"damage"`, `"speed"`, `"maxHealth"`), and a `value`. Additive upgrades stack linearly; multiplicative ones (marked `isMultiplier: true`) compound via the formula `(base + additive) × (1 + multiplicative)`.

Examples: increased bullet damage, faster bullet speed, increased player max health, faster player movement, larger projectile size.

### `effect_upgrades.json` — Gameplay behaviour effects

These upgrades register a named effect in `UpgradeEffectSystem` that triggers on game events. Rather than changing a flat stat, they add behaviour.

Examples:
- **Lifesteal** – heals the player for a percentage of damage dealt on each hit.
- **Regeneration** – heals the player over time each frame.
- **Armor** – reduces all incoming damage by a percentage (minimum 1 damage).
- **Thorns** – reflects a percentage of melee damage back to the attacker.
- **Explode on kill** – creates an AOE explosion when an enemy dies.
- **Multishot** – fires additional projectiles per shot.
- **Ricochet** – projectiles bounce off obstacles instead of being destroyed.

### `variant_upgrades.json` — Projectile class swaps

These upgrades replace the projectile class for a given attack type rather than modifying its stats. Only one variant per attack type can be active at a time (mutually exclusive). Picking a new variant automatically removes the previous one.

Bullet variants:
- **Homing** (`HomingBullet`) – steers toward the nearest enemy.
- **Explosive** (`ExplosiveBullet`) – detonates on impact, dealing AOE damage.
- **Heavy** (`HeavyBullet`) – larger, slower bullet with bonus knockback.

### `ability_upgrades.json` — Player abilities

These upgrades grant entirely new capabilities to the player by registering a named ability in `UpgradeEffectSystem`. The ability must then be triggered by a key bind (dash = SPACE, shield = E).

| Upgrade | Ability | What it does |
|---------|---------|--------------|
| Dash | `dash` | Instant movement burst in the direction of travel |
| Double Dash | `dash` extension | Grants a second dash charge |
| Triple Dash | `dash` extension | Grants a third dash charge |
| Shield | `shield` | Activates a 3-second invulnerability bubble (consumable charges) |

### `visual_upgrades.json` — Visual-only effects

These upgrades add cosmetic effects tracked by `UpgradeEffectSystem` but do not change game-play stats. Examples include glow trails on projectiles and trail effects on the player.

---

## Rarity

All upgrades have a `rarity` field: `common`, `uncommon`, `rare`, `epic`, or `legendary`. Rarity controls how likely an upgrade is to appear in the post-wave roll. The probability table is defined per wave in `Normal.ts` and mirrored in the backend's `upgrade_data.py`. Common upgrades are most frequent in early waves; the distribution gradually shifts toward higher rarities as waves progress.
