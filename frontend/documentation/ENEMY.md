# Enemy

**Base class:** `frontend/src/game/entities/enemies/Enemy.ts`  
**Enemy files:** `frontend/src/game/entities/enemies/`

---

## Base class – `Enemy`

An abstract base class all enemy types extend. Handles physics spawning, sprite rendering, health bar display, knockback, damage, and the rendering lifecycle.

### Stat fields (set in `SetDefaults()`)

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `health` | `number` | 50 | Current HP |
| `maxHealth` | `number` | 50 | Maximum HP (set from `health` on spawn) |
| `speed` | `number` | 60 | Base movement speed (px/s) |
| `damage` | `number` | 10 | Damage dealt on player contact |
| `sides` | `number` | 4 | Number of polygon sides for the sprite texture |
| `radius` | `number` | 20 | Visual radius in pixels |
| `color` | `number` | `0xff0000` | Hex tint color |
| `scoreChance` | `number` | 0.5 | Probability (0–1) that killing this enemy awards 1 point |
| `speedCap` | `number` | 2 | Maximum speed multiplier from wave scaling |
| `scale` | `number` | 1.0 | Visual + hitbox container scale |
| `hitboxSize` | `number` | 1.0 | Collision radius as a fraction of `radius × scale` |
| `knockbackResistance` | `number` | 0 | 0 = full knockback, 1 = immune |
| `barWidth` / `barHeight` | `number` | 20 / 4 | Health bar dimensions |

### Runtime state fields

| Field | Description |
|-------|-------------|
| `x` / `y` | World-space position, synced from container each frame |
| `velocityX` / `velocityY` | Current velocity applied to physics body |
| `rotation` | Current rotation angle |
| `isBoss` | When `true`, the enemy passes through map obstacles |
| `lastHitPlayerTime` | Timestamp of last contact damage to prevent rapid re-hits (500 ms cooldown) |
| `doOldPositionTracking` / `doOldVelocityTracking` / `doOldRotationTracking` | Opt-in flags for history arrays used by trail rendering |
| `oldPositionX[]` / `oldPositionY[]` | Ring buffer of recent world positions (used by `TrailRenderer`) |
| `hitSound` / `deathSound` | Audio keys played on hit and death |

### Abstract method

`SetDefaults()` — override to set the enemy's base stats before spawning.

### Rendering hooks (tModLoader-style)

| Hook | Signature | Default |
|------|-----------|---------|
| `PreDraw()` | `(): boolean` | Returns `true` (proceed) |
| `Draw()` | `(): void` | Updates sprite tint when `color` changes |
| `PostDraw()` | `(): void` | Empty (override for trails, outlines) |

### AI hooks

| Hook | Description |
|------|-------------|
| `PreAI()` | Return `false` to skip AI this frame |
| `AI(playerX, playerY)` | Custom per-frame behaviour. Default is empty — base movement toward player is always applied via `moveTowards()`. |
| `OnHit(damage, source)` | Called when taking damage. Return `false` to cancel the hit. Default plays hit sound. |
| `OnDeath()` | Called when HP reaches 0. Default plays death sound. Override for drops, splits, explosions. |

### Public methods

| Method | Description |
|--------|-------------|
| `moveTowards(tx, ty)` | Lerp velocity toward a target (smoothing factor 0.15). Also lerps rotation. |
| `applyKnockback(vx, vy)` | Sets velocity directly, reduced by `knockbackResistance`. Suppresses AI for 100 ms. |
| `takeDamage(amount, source?)` | Calls `OnHit`, subtracts health, redraws health bar, flashes white. Calls `_die()` if HP ≤ 0. |

### Internal methods (prefixed `_`)

| Method | Description |
|--------|-------------|
| `_spawn(scene, x, y, id)` | Creates the container, sprite, optional health bar/text, and physics body. Called by `EnemyManager`. |
| `_update(playerX, playerY)` | Per-frame tick: syncs position, runs history tracking, calls `PreAI/AI`, sets body velocity, calls render pipeline. |
| `_die()` | Emits `enemy-killed`, calls `OnDeath`, destroys health bar, plays fade-out tween. |
| `_destroy()` | Forcefully removes without death effects (used by `EnemyManager.clear()`). |

---

## Enemy types

All enemies are registered in `frontend/src/game/entities/enemies/index.ts` as a string-keyed registry used by `EnemyManager.spawnEnemy(typeId)`.

| Type ID | Class | Sides | Notes |
|---------|-------|-------|-------|
| `triangle` | `Triangle` | 3 | Basic fast enemy, first introduced wave 1 |
| `square` | `Square` | 4 | Slower, tankier than triangle |
| `super_triangle` | `SuperTriangle` | 3 | Faster, stronger triangle. Renders with an outer outline sprite |
| `pentagon` | `Pentagon` | 5 | Medium enemy |
| `diamond` | `Diamond` | custom rhombus | Uses `TextureGenerator.getOrCreateDiamond()` instead of a polygon. Performs dash attacks toward the player. Dash cooldown decreases at waves 10/15/20 |
| `hexagon` | `Hexagon` | 6 | Tough enemy, appears in boss waves |
| `octogon` | `Octogon` | 8 | High health, introduced mid-game |
| `super_square` | `SuperSquare` | 4 | Enhanced square with outline sprite |
| `dodecahedron` | `Dodecahedron` | 12 | Boss. High health, large size, fires acid projectiles. `isBoss = true` (passes through obstacles) |

### Enemy abilities

Enemy classes can compose from the `frontend/src/game/enemyAbilities/` directory:

| Ability | File | Description |
|---------|------|-------------|
| `Ability` | `Ability.ts` | Abstract base |
| `DashAbility` | `DashAbility.ts` | Rush toward the player |
| `ExplodeAbility` | `ExplodeAbility.ts` | Detonate on death |
| `ShieldAbility` | `ShieldAbility.ts` | Temporary damage immunity |
| `ShootAbility` | `ShootAbility.ts` | Fire projectiles at the player |
| `SplitAbility` | `SplitAbility.ts` | Split into smaller enemies on death |

These abilities are instantiated inside enemy subclass `SetDefaults()` or `AI()` methods and are not automatically applied — each enemy class opts in explicitly.
