# Particle

**Base class:** `frontend/src/game/entities/particles/Particle.ts`
**Built-in types:** `frontend/src/game/entities/particles/BasicParticles.ts`
**Barrel export:** `frontend/src/game/entities/particles/index.ts`

---

## Overview

Particles are customizable shape entities that can be spawned in to create more visual effects for other entities.

Spawned particles have no behavior on their own. When spawned, they drift along whatever velocity they were given and do nothing else until they are despawned when `timeLeft` hits 0.

Update their behavior in the `AI()` method. Also, for a more visually pleasing effect, add randomness to some of the values when spawning. For example:

```typescript
const dust = Particle.NewParticlePerfect(
  SparkParticle, x, y,
  velX * Phaser.Math.FloatBetween(1, 1.05),
  velY * Phaser.Math.FloatBetween(1, 1.05)
)
```

Randomness can be applied when spawning the dust with `Particle.NewParticle` / `NewParticlePerfect`, or in the class for the dust in the `OnSpawn()` method.

### Relationship to Terraria dusts

This system is a direct port of Terraria / tModLoader `Dust`, and the same three rules apply:

1. **Purely visual.** No physics body, no collision, no damage. Nothing in the game ever queries a particle — it draws itself and dies. Gameplay logic never belongs in a particle.
2. **Pooled.** Spawning does not allocate. Instances and their sprites are recycled through a fixed-size slot array, which is what makes it safe to spawn dozens per frame from a projectile's `AI()`.
3. **A subclass is a "dust type."** Behaviour lives in the class (`SetDefaults`/`OnSpawn`/`AI`/`OnKill`); per-spawn variation is applied at the call site.

| Terraria | Polygon |
|---|---|
| `Dust.NewDust(...)` → int index | `Particle.NewParticle(...)` → slot handle |
| `Dust.NewDustPerfect(...)` → `Dust` | `Particle.NewParticlePerfect(...)` → instance |
| `Main.dust[i]` | `Particle.Get(i)` |
| `ModDust.SetDefaults(dust)` | `SetDefaults()` |
| `ModDust.Update(dust)` → bool | `AI()` + `useBuiltInMotion` |
| `dust.active = false` | `Kill()` |
| `dust.noGravity` | `gravityX` / `gravityY` = 0 |
| `Main.maxDusts` (6000) | `Particle.MAX_PARTICLES` (2000) |

---

## Spawning

### `NewParticlePerfect()` — preferred

Returns the instance so its fields can be adjusted directly. Returns `null` when the pool is full or the system is uninitialized, so **always null-check**.

```typescript
static NewParticlePerfect<T extends Particle>(
  type: ParticleType<T>,
  posX: number,
  posY: number,
  velocityX: number = 0,
  velocityY: number = 0,
  options?: ParticleOptions
): T | null
```

### `NewParticle()` — Terraria-style handle

Same arguments, returns the pool slot index or `-1`. Use with `Particle.Get(id)`.

### `Burst()` — radial spray

Fans `count` particles around a point, the usual shape of an impact or death effect.

```typescript
Particle.Burst(SparkParticle, x, y, 12, {
  speed: 200,          // default 150
  speedVariance: 0.4,  // fractional spread on speed, default 0.3 (±30%)
  spread: Math.PI * 2, // arc in radians, default full circle
  direction: 0,        // center of that arc in radians
  jitter: 2 / 3,       // angular wobble within each slot, default 2/3
  randomAngle: false,  // fully independent angles, default false
  color: this.color
})
```

**How angles are chosen.** By default the burst is *stratified*, not random: each particle is assigned its own evenly-spaced slot in the arc, then wobbles inside it by up to `±(step × jitter / 2)`. Speed is independently random for every particle regardless.

| `jitter` | Result |
|---|---|
| `0` | Perfectly even spacing — a mechanical starburst |
| `2/3` (default) | Even spacing with a visible wobble |
| `1` | Anywhere within its own slot; maximum variation with no clumping |

Set `randomAngle: true` to skip slots entirely and draw each angle uniformly across `spread`. This is what most people picture as "random angles," but independent draws **clump** — some directions get several particles while others get none, which usually reads as a bug rather than as randomness. Stratified sampling is the default for that reason. Reach for `randomAngle` when the clumping is the effect you want (sputtering, scattered embers), or when the burst is large enough that clumps average out.

### `ParticleOptions`

Applied **after** `SetDefaults()` and **before** `OnSpawn()`, so they override type defaults but can still be adjusted per-spawn.

`timeLeft`, `color`, `scale`, `rotation`, `alpha`, `radius`, `sides`, `depth`, `additive`

### Spawning from a projectile

```typescript
import { Particle } from '../../particles/Particle'
import { SparkParticle } from '../../particles/BasicParticles'

export class Bullet extends Projectile {
  private lastParticleTime: number = 0

  // Trail — rate-limited so density doesn't scale with refresh rate
  AI(): void {
    if (this.scene.time.now - this.lastParticleTime >= 50) {
      this.lastParticleTime = this.scene.time.now
      const p = Particle.NewParticlePerfect(
        SparkParticle, this.positionX, this.positionY,
        -this.velocityX * 0.15 * Phaser.Math.FloatBetween(0.5, 1.5),
        -this.velocityY * 0.15 * Phaser.Math.FloatBetween(0.5, 1.5)
      )
      if (p) p.color = this.color
    }
  }

  // Death burst
  OnKill(): void {
    Particle.Burst(SparkParticle, this.positionX, this.positionY, 12, {
      speed: 180,
      color: this.color
    })
  }
}
```

---

## Lifecycle hooks

| Hook | When | Notes |
|---|---|---|
| `SetDefaults()` | Every spawn, before options are applied | **Abstract.** Instances are pooled, so this runs on every reuse |
| `OnSpawn()` | Once, after position/velocity/options are set | The natural home for per-spawn randomness |
| `AI()` | Every frame, before the built-in motion integration | Modify velocity/scale/color here |
| `PreDraw()` | Every frame | Return `false` to skip `Draw()` this frame |
| `Draw()` | Every frame | Pushes state onto the sprite; override for custom rendering |
| `OnKill()` | On death (expiry, fade-out, or `Kill()`) | Keep cheap — can fire hundreds of times a second |

Call order per spawn: `_resetFields()` → `SetDefaults()` → options → `OnSpawn()` → first `Draw()`.

There is deliberately **no Graphics path and no `PostDraw()`**, unlike `Projectile`. Particles are leaf visuals spawned in bulk; per-particle Graphics would erase the performance advantage of the pool.

---

## Defining a new particle type

Extend `Particle` and override `SetDefaults()`. Put per-spawn randomness in `OnSpawn()`, and per-frame behaviour in `AI()`.

```typescript
import Phaser from 'phaser'
import { Particle } from './Particle'

export class EmberParticle extends Particle {
  SetDefaults(): void {
    this.sides = 1          // circle
    this.radius = 3
    this.color = 0xff8800
    this.timeLeft = 500
    this.fadeOutTime = 350  // fade over the last 350ms of life
    this.friction = 0.2     // keeps 20% of its speed per second
    this.additive = true    // glowy
  }

  OnSpawn(): void {
    // Per-spawn randomness belongs here (or at the call site)
    this.scale *= Phaser.Math.FloatBetween(0.7, 1.3)
    this.rotation = Phaser.Math.FloatBetween(0, Math.PI * 2)
  }

  AI(): void {
    // Runs every frame, BEFORE the built-in motion integration
  }
}
```

Because instances are pooled, `SetDefaults()` runs on **every** spawn, not once per class. Anything it doesn't set falls back to the base-class default — never to a value left over from the previous particle that used the slot.

### Animating over the particle's life

`lifeProgress` runs 0 → 1 across the lifetime, which is the cleanest way to drive colour or size curves without tracking your own timer.

```typescript
// Hoisted out of the class — allocating two Color objects per particle per
// frame would undo the point of the pool
const HOT = Phaser.Display.Color.ValueToColor(0xffdd44)
const COOL = Phaser.Display.Color.ValueToColor(0xaa1100)

export class CoolingEmberParticle extends Particle {
  SetDefaults(): void {
    this.sides = 1
    this.radius = 4
    this.timeLeft = 800
    this.additive = true
  }

  AI(): void {
    // Yellow-hot at spawn, deep red by the end
    const c = Phaser.Display.Color.Interpolate.ColorWithColor(
      HOT, COOL, 100, this.lifeProgress * 100
    )
    this.color = Phaser.Display.Color.GetColor(c.r, c.g, c.b)
  }
}
```

`Interpolate.ColorWithColor` returns a plain `{ r, g, b }` object, not a packed integer — `GetColor` does the conversion that `color` expects.

### Taking over movement entirely

Set `useBuiltInMotion = false` to skip the base class's velocity/gravity/friction integration and drive `posX`/`posY` yourself. This is the equivalent of returning `false` from tModLoader's `ModDust.Update`.

```typescript
export class OrbitParticle extends Particle {
  private originX: number = 0
  private originY: number = 0
  private orbitRadius: number = 20

  SetDefaults(): void {
    this.sides = 1
    this.radius = 2
    this.timeLeft = 1200
    this.fadeOutTime = 400
    this.useBuiltInMotion = false // We position the particle ourselves
  }

  OnSpawn(): void {
    this.originX = this.posX
    this.originY = this.posY
  }

  AI(): void {
    const angle = this.lifeProgress * Math.PI * 4 // Two full loops over its life
    this.posX = this.originX + Math.cos(angle) * this.orbitRadius
    this.posY = this.originY + Math.sin(angle) * this.orbitRadius
  }
}
```

### Ending a particle early

`Kill()` marks it dead; it is released back to the pool at the start of the next frame and `OnKill()` fires then.

```typescript
AI(): void {
  if (this.posY > WORLD_HEIGHT) this.Kill()
}
```

---

## Field reference

### Position & movement

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `posX` / `posY` | `number` | 0 | World-space position in pixels |
| `velocityX` / `velocityY` | `number` | 0 | Velocity in pixels per second |
| `gravityX` / `gravityY` | `number` | 0 | Constant acceleration (px/s²). The top-down equivalent of Terraria's `noGravity` — 0 means the particle keeps drifting |
| `friction` | `number` | 1 | Fraction of velocity retained per second. `1` = no drag, `0.3` = keeps 30% of its speed each second, `0` = stops instantly. Applied as `velocity *= friction^dt`, so it is frame-rate independent |
| `rotation` | `number` | 0 | Current angle in radians |
| `rotationVelocity` | `number` | 0 | Spin in radians per second |

### Lifetime

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `timeLeft` | `number` | 1000 | Milliseconds remaining. **Genuinely decrements each frame** |
| `maxTimeLeft` | `number` | 1000 | Lifetime the particle spawned with; used to derive fade/life progress |
| `active` | `boolean` | false | Set false to kill the particle at the start of the next frame |
| `lifeProgress` | `number` (getter) | — | 0 (just spawned) to 1 (dead) |

### Appearance

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `color` | `number` | `0xffffff` | Hex tint |
| `radius` | `number` | 4 | Base radius in pixels, before `scale` |
| `scale` | `number` | 1.0 | Radius multiplier |
| `scaleVelocity` | `number` | 0 | Growth/shrink per second. The particle dies early if `scale` reaches 0 |
| `alpha` | `number` | 1.0 | Base opacity; multiplied by the fade factor at draw time |
| `fadeInTime` | `number` | 0 | Milliseconds ramping opacity 0 → `alpha` at start of life |
| `fadeOutTime` | `number` | 0 | Milliseconds ramping opacity `alpha` → 0 at end of life |
| `sides` | `number` | 1 | 1 = circle, 2 = ellipse, 3+ = polygon |
| `ellipseRatio` | `number` | 0.5 | Short/long axis ratio, only when `sides === 2` |
| `angles` | `number[]` | `[]` | Central angle per side; empty = regular polygon. See **Shapes** |
| `vertexRadii` | `number[]` | `[]` | Per-vertex distance from center, as a multiple of `radius` |
| `additive` | `boolean` | false | Additive blending for glowing embers/sparks/energy |
| `depth` | `number` | 50 | Render depth. Player is 100, projectiles/enemies are 0, so the default draws over the action but under the player |

### Behaviour

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `useBuiltInMotion` | `boolean` | true | When true, the base class integrates velocity, gravity, friction, spin and scale each frame after `AI()`. Set false to drive position entirely from `AI()` — the equivalent of returning `false` from tModLoader's `ModDust.Update` |

---

## Shapes

| `sides` | Shape | Texture source |
|---|---|---|
| 1 | Circle | `TextureGenerator.getOrCreateCircle` |
| 2 | Ellipse | Circle texture squashed by `ellipseRatio` at draw time |
| 3+ (no `angles`) | Regular polygon | `TextureGenerator.getOrCreatePolygon` |
| 3+ (with `angles`/`vertexRadii`) | Irregular polygon | `TextureGenerator.getOrCreateIrregularPolygon` |

### Irregular polygons

The shape is a **fan of triangles around the center**: `angles[i]` is the central angle swept between vertex *i* and vertex *i+1*, and `vertexRadii[i]` is how far vertex *i* sits from the center as a multiple of `radius`. This keeps any combination mathematically consistent:

- The central angles of a closed fan must total 360°, so `angles` is **normalized** to that total. Only the proportions matter — `[1, 1, 2]` and `[90, 90, 180]` describe the same triangle.
- Because every vertex is anchored to the center, the outline **always closes**, no matter what radii are used. Irregular side lengths can never produce an invalid shape.
- Side lengths are therefore *derived* rather than specified:

  `L_i = √(r_i² + r_i+1² − 2·r_i·r_i+1·cos(θ_i))`

```typescript
// A dart: tip at full radius, two base vertices pulled in and swung wide
this.sides = 3
this.angles = [130, 100, 130]
this.vertexRadii = [1, 0.5, 0.5]
this.radius = 10
```

**Sizing pitfall:** `radius` sets the *envelope* the vertices sit in, not the size of the drawn shape. Bunching vertices into a narrow arc leaves most of that envelope empty, so the shape comes out far smaller than `radius` suggests — `[30, 30, 300]` at `radius = 5` renders under 2px wide and is effectively invisible. Spread the angles out before reaching for a bigger `radius`.

**Caching:** each distinct `angles`/`vertexRadii` combination bakes its own texture, keyed on the full arrays. Use a few fixed shapes and vary tint/scale/rotation for variety — never randomize these arrays per particle.

### Streaks — `SetStreak(length, thickness)`

For ellipses, `radius` scales **both** axes and `ellipseRatio` is thickness *relative to* length, so lengthening a streak by hand means raising one and dividing the other by the same factor. `SetStreak()` does that conversion, taking both dimensions in pixels:

```typescript
particle.SetStreak(24, 3) // 24px long (along rotation), 3px thick
```

It sets `sides = 2` and resets `scale` to 1, since `scale` multiplies both axes and would otherwise undo the given dimensions. Call it **after** `SetDefaults()`/spawn options.

---

## Built-in types

General-purpose "dust types" meant to be spawned directly and re-tinted at the call site, the way Terraria code reaches for a handful of common `DustID`s.

| Type | Shape | Behaviour | Use for |
|---|---|---|---|
| `SparkParticle` | Circle, additive | Shoots out, heavy drag, fades. Randomized scale and lifetime | Impacts, muzzle flashes, death bursts |
| `SmokeParticle` | Circle | Drifts, expands, fades in then out | Exhaust trails, dissipating clouds, explosion afterglow |
| `ShardParticle` | Irregular triangle (dart) | Tumbles and shrinks away | Debris from destroyed entities |
| `StreakParticle` | Ellipse, additive | Stretched along travel direction; re-aims to face its own velocity each frame | Motion streaks, tracer trails |

Note `StreakParticle.AI()` only re-aims when velocity is non-zero — spawning with `0, 0` velocity preserves whatever `rotation` was passed in.

---

## Recipes

Common effects, all using the built-in types. Every one of these belongs in a projectile, enemy, or player hook — never in the particle itself.

### Muzzle flash

A tight cone fired in the direction the shot went, spawned once from `OnSpawn()`.

```typescript
OnSpawn(): void {
  Particle.Burst(SparkParticle, this.positionX, this.positionY, 6, {
    speed: 220,
    spread: Math.PI / 4,   // 45° cone
    direction: this.rotation,
    color: this.color
  })
}
```

### Rate-limited trail

Emits on a wall-clock interval so density is identical on a 60Hz and a 144Hz display.

```typescript
private lastParticleTime: number = 0

AI(): void {
  if (this.scene.time.now - this.lastParticleTime >= 40) {
    this.lastParticleTime = this.scene.time.now

    const p = Particle.NewParticlePerfect(
      SparkParticle, this.positionX, this.positionY,
      -this.velocityX * 0.15 * Phaser.Math.FloatBetween(0.5, 1.5),
      -this.velocityY * 0.15 * Phaser.Math.FloatBetween(0.5, 1.5)
    )
    if (p) p.color = this.color
  }
}
```

Throwing the sparks *backwards* out of the projectile (negative velocity, scaled down) and jittering the magnitude is what makes it read as a trail rather than a dotted line.

### Streak trail

`StreakParticle` with zero velocity keeps the rotation it was given, so it lines up with the projectile's heading. This is what `Bullet` uses.

```typescript
const streak = Particle.NewParticlePerfect(
  StreakParticle, this.positionX, this.positionY, 0, 0,
  { timeLeft: 300, color: this.color, rotation: this.rotation }
)
if (streak) streak.SetStreak(12, 2) // 12px long, 2px thick
```

### Death burst

```typescript
OnKill(): void {
  Particle.Burst(SparkParticle, this.positionX, this.positionY, 12, {
    speed: 180,
    speedVariance: 0.4,
    color: this.color
  })
}
```

### Scattered burst

When you want real clumping rather than even spacing — sputtering embers, debris that didn't come apart symmetrically.

```typescript
Particle.Burst(SparkParticle, x, y, 15, {
  speed: 160,
  randomAngle: true,   // Fully independent angles; expect clumps and gaps
  speedVariance: 0.6,
  color: this.color
})
```

### Manual radial loop

The equivalent of Terraria's `new Vector2(speed, 0).RotatedBy(angle)`. Useful when you need per-particle control that `Burst()` doesn't expose — different types per index, position offset along the ray, and so on.

```typescript
const count = 10
const speed = 150

for (let i = 0; i < count; i++) {
  const angle = (Math.PI * 2 / count) * i
  Particle.NewParticle(SparkParticle, this.positionX, this.positionY,
    Math.cos(angle) * speed,
    Math.sin(angle) * speed,
    { color: this.color, timeLeft: 300, radius: 1.5 })
}
```

Phaser's `Vector2` works too, if the vector semantics read better to you. Hoist a single instance and reuse it — allocating one per particle undoes the pooling:

```typescript
const v = new Phaser.Math.Vector2()

for (let i = 0; i < count; i++) {
  v.setToPolar(Phaser.Math.DegToRad(36 * i), speed) // Phaser rotation is radians
  Particle.NewParticle(SparkParticle, this.positionX, this.positionY, v.x, v.y, {
    color: this.color, timeLeft: 300
  })
}
```

To make the spray drift with its parent instead of sitting still, add a fraction of the parent velocity to each component: `Math.cos(angle) * speed + this.velocityX * 0.2`.

### Explosion — layered burst

Layering a fast bright ring, slow debris, and lingering smoke reads far better than any single burst. Note the descending `depth` values so smoke sits behind the sparks.

```typescript
OnKill(): void {
  const x = this.positionX
  const y = this.positionY

  Particle.Burst(SparkParticle, x, y, 20, { speed: 300, color: 0xffcc44 })
  Particle.Burst(ShardParticle, x, y, 8,  { speed: 140, color: this.color })
  Particle.Burst(SmokeParticle, x, y, 6,  { speed: 50, depth: 45 })
}
```

### Directional impact spray

Spraying *away* from the surface hit, using the angle back toward the projectile.

```typescript
OnHitNPC(enemy: any): boolean {
  const away = Phaser.Math.Angle.Between(enemy.x, enemy.y, this.positionX, this.positionY)

  Particle.Burst(SparkParticle, this.positionX, this.positionY, 8, {
    speed: 200,
    spread: Math.PI / 2, // 90° fan
    direction: away,
    color: this.color
  })
  return true
}
```

### Falling debris with gravity

`gravityY` is the top-down stand-in for Terraria's `noGravity` flag — leave it 0 and the particle keeps drifting.

```typescript
const p = Particle.NewParticlePerfect(
  ShardParticle, x, y,
  Phaser.Math.FloatBetween(-80, 80),
  Phaser.Math.FloatBetween(-140, -60)  // Thrown upward...
)
if (p) {
  p.gravityY = 400   // ...then pulled back down
  p.friction = 0.9   // Light air drag
  p.timeLeft = 1200
}
```

### Ambient emitter on an enemy

Enemies have no particle hook of their own; call from the enemy's per-frame `AI()` override. `Enemy._update()` runs the default `moveTowards()` *before* calling `AI()`, so overriding it adds behaviour rather than replacing movement.

```typescript
AI(_playerX: number, _playerY: number): void {
  // ~1 in 12 frames, so roughly 5-10 per second depending on refresh rate
  if (Phaser.Math.Between(0, 11) === 0) {
    Particle.NewParticlePerfect(
      SmokeParticle,
      this.x + Phaser.Math.FloatBetween(-this.radius, this.radius),
      this.y + Phaser.Math.FloatBetween(-this.radius, this.radius),
      0, -20
    )
  }
}
```

### Terraria-style handle usage

If you prefer the `Dust.NewDust` shape, `NewParticle` returns a pool slot and `Get()` looks it back up. Functionally identical to `NewParticlePerfect`, just with an extra lookup.

```typescript
const d = Particle.NewParticle(SparkParticle, x, y, velX, velY)
const p = Particle.Get(d)
if (p) p.scale = 1.5
```

### Budgeting spawns

`Particle.Count` is live, so heavy effects can back off when the pool is under pressure rather than getting silently truncated mid-burst.

```typescript
OnKill(): void {
  const budget = Particle.MAX_PARTICLES - Particle.Count
  const count = Math.min(20, Math.floor(budget * 0.1))
  if (count > 0) {
    Particle.Burst(SparkParticle, this.positionX, this.positionY, count, { speed: 250 })
  }
}
```

---

## Pooling & performance

- **One texture per shape.** Every particle texture is baked at `BASE_TEXTURE_RADIUS` (16) and every `radius`/`scale` combination is reached by scaling that sprite. Size can change freely at runtime without ever generating another texture.
- **`MAX_PARTICLES` is 2000.** Spawns past that are silently dropped (`NewParticlePerfect` returns `null`, `NewParticle` returns `-1`), exactly as Terraria drops dust once `Main.dust` is full. Particles are cosmetic, so skipping is always better than dropping frames.
- **Instances and sprites are recycled per type.** A dead particle goes back onto a free list keyed by its class, keeping its sprite.
- **`SetDefaults()` must set every field the type cares about.** `_resetFields()` restores base-class defaults before each `SetDefaults()` call, so nothing leaks between pooled uses — but a field the type never sets falls back to the base default, not to the value it had last time. When adding a field to `Particle`, add it to `_resetFields()` too.
- **`angles`/`vertexRadii` are emptied in place** rather than reassigned, so the common regular-shape path stays allocation-free.

---

## Scene integration

Three touch points in `MainScene.ts`:

| Call | Location | Purpose |
|---|---|---|
| `Particle.Initialize(this)` | `create()`, after `TextureGenerator.generateCommonTextures(this)` | Binds the pool to the scene. Safe to re-call on scene restart — all previous particles and their sprites are discarded |
| `Particle.UpdateAll(delta)` | `update()` | Advances every live particle. Runs after the pause guard, so particles freeze with the game |
| `Particle.Clear()` | `'clear-projectiles'` handler | Kills everything at end of wave, alongside `player.clearProjectiles()` |

`Particle.Count` reports how many are currently alive.

---

## Gotchas

**`timeLeft` means something different here than on `Projectile`.** `Particle.timeLeft` is a real countdown, decremented by `delta` each frame. `Projectile.timeLeft` is a *constant lifetime budget* compared against `scene.time.now - spawnTime` and never mutates. Modulo tricks like `if (this.timeLeft % 50 === 0)` inside a projectile's `AI()` are therefore always true — `3000 % 50` is `0` on every frame.

**`AI()` is not called at a fixed 60fps.** `gameConfig` sets no `fps` block, so Phaser drives the loop from `requestAnimationFrame` — the rate follows the display (120fps on a ProMotion Mac). Frame-counted spawn cadence emits twice as densely there as on a 60Hz screen. Gate on elapsed time instead:

```typescript
if (this.scene.time.now - this.lastParticleTime >= 50) { ... }
```

Arcade physics is separate and does run a fixed 60Hz step, so a projectile's body position can repeat between two `AI()` calls on a high-refresh display — another reason a per-frame trail can look clumped.

**Randomness in particles should stay unseeded.** `Phaser.Math.Between` / `FloatBetween` are the right helpers here. They wrap `Math.random()` and are not seeded, which is fine because particles are purely visual and never touch wave validation.