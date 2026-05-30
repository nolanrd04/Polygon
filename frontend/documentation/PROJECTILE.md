# Projectile

**Base class:** `frontend/src/game/entities/projectiles/Projectile.ts`

---

## Base class – `Projectile`

An abstract base class for all projectiles. Handles spawning, physics movement, lifetime tracking, per-enemy hit cooldowns, pierce logic, and the rendering lifecycle.

### Stat fields (set in `SetDefaults()`)

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `damage` | `number` | 10 | Damage per hit |
| `damageMultiplier` | `number` | 1 | Multiplied against `damage` at collision time (e.g. 0.5 for reduced-damage hits) |
| `speed` | `number` | 400 | Travel speed (px/s) |
| `size` | `number` | 5 | Radius in pixels; drives both the hitbox and sprite scale |
| `pierce` | `number` | 1 | Maximum unique enemies this projectile can hit before being destroyed |
| `color` | `number` | `0x00ffff` | Hex tint |
| `glowAlpha` | `number` | 0.3 | Opacity of the glow effect layer |
| `glowScale` | `number` | 1.5 | Size of glow relative to main sprite |
| `timeLeft` | `number` | 60 000 | Lifetime in milliseconds before auto-destroy |
| `hitEnemyCooldown` | `number` | 500 | Milliseconds before the same enemy can be hit again by this projectile. Allows homing/piercing projectiles to re-hit |
| `canCutTiles` | `boolean` | false | If true, terrain collisions count as pierce hits but don't destroy the projectile |
| `knockback` | `number` | 0 | Knockback force applied to enemies on hit |
| `spawnSound` | `string` | `''` | Audio key played on spawn |

### Position & movement fields

| Field | Description |
|-------|-------------|
| `positionX` / `positionY` | World-space position, synced from physics body each frame |
| `velocityX` / `velocityY` | Current velocity; modify in `AI()` for homing/curved shots |
| `rotation` | Current angle in radians |
| `owner` | `'player'` or `'enemy'` |
| `ownerId` | ID of the entity that spawned this projectile |
| `doOldPositionTracking` | Opt-in flag for trail rendering |
| `oldPositionX[]` / `oldPositionY[]` | Ring buffer of past positions |

### Abstract method

`SetDefaults()` — override to set the projectile's base stats.

### Rendering hooks

| Hook | Signature | Default |
|------|-----------|---------|
| `PreDraw()` | `(): boolean` | Returns `true` |
| `Draw()` | `(): void` | Updates sprite tint when `color` changes; updates sprite scale when `size` changes |
| `PostDraw()` | `(): void` | Empty (override for trails) |

### Lifecycle hooks

| Hook | Description |
|------|-------------|
| `AI()` | Called every frame. Override to change velocity for homing or curved behavior. Default: no-op (straight line). |
| `OnHitNPC(enemy)` | Called when hitting an enemy. Return `false` to suppress default collision damage (e.g. `ExplosiveBullet` handles its own AOE). |
| `OnObstacleCollide(obstacle?)` | Called when hitting a map obstacle. |
| `OnKill()` | Called when the projectile is destroyed for any reason. Override for death effects (explosions, particles). |

### Helper methods (usable in `AI()` or hooks)

| Method | Description |
|--------|-------------|
| `distanceTo(x, y)` | Euclidean distance to a point |
| `angleTo(x, y)` | Angle in radians toward a point |
| `moveTowards(x, y)` | Sets velocity and rotation to move toward a point at current `speed` |
| `ricochet(obstacle)` | Reflects velocity off an obstacle using the surface normal. Increments pierce count; destroys if exhausted. |
| `swapToCustomCircle(options)` | Replaces the default sprite with a custom-colored translucent circle texture. |

### Internal methods (prefixed `_`)

| Method | Description |
|--------|-------------|
| `_spawn(scene, sx, sy, tx, ty)` | Creates container, sprite, optional graphics, physics body. Sets initial velocity toward target. |
| `_update()` | Per-frame: syncs position, checks lifetime, calls `AI()`, applies velocity, calls render pipeline. |
| `_canHitEnemy(enemyId)` | Returns `true` if the hit cooldown for this enemy has elapsed. |
| `_recordHit(enemyId)` | Records hit timestamp, increments `currentPierceCount` on first hit of each unique enemy. Destroys if pierce limit reached. |
| `_isOutOfBounds(w, h)` | Returns `true` if position is outside the world bounds plus a 50 px margin. |
| `_destroy()` | Calls `OnKill`, destroys the container, removes from `GameManager` registry. |

---

## Player projectiles

Located in `frontend/src/game/entities/projectiles/player_projectiles/`.

### Bullet (and variants)

**File:** `Bullet.ts`

The default projectile. Small, fast, green-tinted circles. Multishot and pierce upgrades apply directly. Three subclasses swap behavior via `OnHitNPC` / `AI`:

| Class | Behavior |
|-------|----------|
| `Bullet` | Default straight-line shot |
| `HeavyBullet` | Larger, slower, higher damage, more knockback |
| `HomingBullet` | In `AI()`, steers toward the nearest enemy using a lerp on velocity |
| `ExplosiveBullet` | `OnHitNPC` returns `false`; instead emits `enemy-explode` for AOE damage handled by `MainScene` |

### Laser

**File:** `Laser.ts`

High-speed thin beam. Uses `usesCustomRendering = true` to draw a line with a glow using Phaser `Graphics` rather than a circle sprite.

### Zapper

**File:** `Zapper.ts`

Chain-lightning projectile. On collision, it jumps to the nearest enemy within a set radius.

### Flame

**File:** `Flame.ts`

Continuous short-range cone. Only one instance exists at a time; when the player holds fire it repositions the existing flame rather than spawning a new one.

### Spinner

**File:** `Spinner.ts`

A large spinning hitbox that orbits the player. Uses `followPlayer(x, y)` to track the player position. Only one spinner can be active at a time. `pierce` is set to the player's `sides` count so a more-evolved polygon has more piercing hits per revolution.

---

## Enemy projectiles

Located in `frontend/src/game/entities/projectiles/enemy_projectiles/`.

| Class | Description |
|-------|-------------|
| `EnemyBullet` | Basic enemy projectile. Straight-line. |
| `AcidBullet` | Slow-moving projectile fired by the Dodecahedron boss. |
| `AcidExplosion` | AOE hazard created when an AcidBullet lands. |
| `DodecahedronBullet` | Boss-specific projectile with custom stats and visual. |
