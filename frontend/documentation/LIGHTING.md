# Lighting

A **Terraria-inspired light map**. Light lives on a grid, floods outward tile
by tile, and the result is multiplied over the world as a single full-map
overlay. It is not Phaser's `Light2D`.

**Files:**

| File | Contents |
|------|----------|
| `frontend/src/game/systems/LightingSystem.ts` | The whole system — flood, bake, tone map, overlay |
| `frontend/src/game/systems/MapManager.ts` | Registers occluders + emissive grid/obstacles; owns the albedo colours |
| `frontend/src/game/data/ID.ts` | `LightingRadiusID` — the shared radius palette |
| `frontend/src/game/core/PerfStats.ts` | Per-frame timing written by `MainScene` |
| `frontend/src/components/PerfOverlay.tsx` | On-screen readout (`?perf=1`) |

---

## Why not Phaser's Light2D

`Light2D` is a per-object shader. Three things ruled it out:

1. **It only lights objects you opt in** with `setPipeline('Light2D')`, and it
   does not work on `Graphics` — which is what the background grid and the
   obstacles are.
2. **It has no occlusion at all.** Lights pass straight through obstacles.
3. **It caps at 10 lights** (`maxLights` is baked into the fragment shader at
   boot and cannot change at runtime).

More fundamentally, `Light2D` is **multiplicative**:

```glsl
gl_FragColor = color * vec4(colorOutput.rgb * colorOutput.a, colorOutput.a);
//              ^albedo        ^(ambient + accumulated lights)
```

Multiply can only ever darken. On the original near-black floor (`0x0a0a0f`),
`albedo * light` stays near-black no matter how bright the light — so nothing
ever looked lit. That constraint drove the entire design below.

---

## The model

1. **Lights inject brightness** into the tile they occupy.
2. That value **spreads tile to tile**, multiplied by a decay factor at each
   step. There is no distance-squared falloff anywhere — the falloff is emergent
   from repeated decay across the grid.
3. Decay is steeper through **solid tiles**, so obstacles darken and occlude.
4. The low-res buffer (one texel per tile) is **bilinearly upscaled** to world
   size and composited `MULTIPLY`. That upscale is what turns a coarse grid into
   smooth gradients.

The world is 2560×1440 at `tileSize` 16, so the light map is **160×90 = 14,400
tiles**.

### Propagation

Alternating forward/backward sweeps over the whole grid, `iterations` (2) pairs
of them. Each tile takes the brightest of itself and its already-visited
neighbours scaled by **that neighbour's** decay — so light is attenuated by the
medium it travelled *out of*, which is what makes an obstacle darken the tiles
beyond it rather than its own lit face.

Diagonal neighbours are included, attenuated by `decay ^ shape`. **Without them
the flood measures Manhattan distance and every light renders as a diamond** —
this was a real bug during development; roundness measured 0.75 before the fix
and 1.01 after.

### Tone mapping

Output is `1 - exp(-light * exposure)`, not a hard clamp. A clamp turned every
light at or above 1.0 into a flat white disc with a hard edge:

| light | hard clamp | tone map |
|-------|-----------|----------|
| 1.0 | 1.000 | 0.632 |
| 2.0 | **1.000** | 0.865 |
| 3.0 | **1.000** | 0.950 |

Three very different light levels used to render identically.

---

## The overlay and depth

The light map is one `Image` covering the world, `BlendMode.MULTIPLY`, at
`OVERLAY_DEPTH = -5`.

Phaser's `MULTIPLY` is `[DST_COLOR, ONE_MINUS_SRC_ALPHA]`, which reduces to a
clean `src * dst` **only at alpha 1** — every texel's alpha is held at 255 for
exactly that reason. Any lower and the unlit scene bleeds back through.

Depth ordering, and why:

| depth | what | lit? |
|-------|------|------|
| -10 | background grid (`Graphics`) | yes |
| -9 | obstacles (`Graphics`) | yes |
| **-5** | **light overlay** | — |
| -1 | trails | no |
| 0 | enemies, projectiles | no |
| 100 | player | no |
| 400+ | touch controls, UI | no |

**Entities sit above the overlay on purpose.** Entity colour is gameplay signal,
and a coloured light multiplied over a differently-coloured sprite destroys it —
a green player light over a red enemy multiplies out to near-black. Light shapes
the environment; entities keep their authored colours.

Raise `OVERLAY_DEPTH` above 100 for true Terraria behaviour, where entities
themselves go dark in unlit areas. Keep it under 400 either way.

---

## Albedo: why the map colours changed

Because compositing is multiply, `MapManager`'s biome colours are now **albedo** —
the colour a surface shows when *fully lit* — not final colour. Unlit, each is
scaled down by `ambient`.

| | albedo | unlit (× 0.10) | original |
|---|---|---|---|
| `backgroundColor` | `0x2a2a3a` | ~`0x040406` | `0x0a0a0f` |
| `gridColor` | `0x7a7ab8` | ~`0x0c0c12` | `0x1a1a2f` |
| `obstacleColor` | `0x4a4a62` | ~`0x070709` | `0x333344` |

**`backgroundColor` is the one to be careful with.** It covers the entire screen,
so brightness there does not read as lighting — it reads as uniform haze over the
whole frame. Raising it to `0x54546e` during development is exactly what produced
a flat grey fog. It is kept dark; the **grid and obstacles** are what light is
meant to reveal.

`gridColor` and `obstacleColor` do double duty: they are what the map is *drawn*
with **and** the colour of the light those surfaces *emit*. To give a surface a
glow of a different hue than itself, they would need splitting into separate
emission colours.

---

## Self-illumination (`BakeLight`)

Light a surface gives off by itself, rather than light falling on it. This is
what stops unlit areas from being a featureless black void — the darkness keeps
its structure.

`MapManager.bakeLighting()` registers, once per map:

- every **obstacle**, at its own radius (`OBSTACLE_EMISSION = 1`)
- every **grid line**, walked at light-tile resolution (`GRID_EMISSION = 0.50`)

**Baked light is not flooded.** Flooding it would defeat the purpose: emitters
only a few tiles apart (a 50px grid) bleed into each other and flatten back into
uniform haze. Held in place it stays a lattice, and the bilinear upscale already
gives each tile a soft 16px falloff.

Grid baking passes **`skipSolid: true`**. The grid is painted on the *floor*, and
the floor does not exist where an obstacle covers it. Without the flag, grid
emission lands on the obstacle's own tiles and shows through as bright bands
running across it — obstacles render *below* the overlay, so they get multiplied
by whatever light hits their tiles.

> The occluder mask is a separate `Uint8Array`, not inferred from the `decay`
> float array. `Float32Array` stores `0.93` as `0.9300000071525574`, so comparing
> an entry back against the float64 `airDecay` is never equal and every tile
> silently reports "solid" — which would delete the entire grid glow.

---

## API

Static, matching the `Particle` pool convention.

```ts
// Once in MainScene.create() — BEFORE generateMap(), which bakes into it
LightingSystem.Initialize(this, { ambient: 0.10, exposure: 1.0 })

// MapManager.bakeLighting() does these
LightingSystem.SetOccluders(obstacleData)
LightingSystem.BakeLight(x, y, color, intensity, radius?, skipSolid?)
LightingSystem.ClearBaked()

// Any entity, any frame, any hook
LightingSystem.AddLight(x, y, color, intensity, radius?, shape?)

// Once at the END of MainScene.update()
LightingSystem.UpdateAll()
```

`AddLight` is **immediate-mode**: a light exists for exactly the frame it was
added. Nothing to register, nothing to clean up — a bullet stops lighting the
room by no longer calling `AddLight`.

`UpdateAll()` must come last in `update()`, after every entity has had its chance
to emit.

---

## Light shape

Shape is set by **what a diagonal step costs** relative to an orthogonal one.
That number picks the distance metric the flood measures in, and the metric *is*
the shape:

| constant | value | metric | shape |
|----------|-------|--------|-------|
| `SHAPE_SQUARE` | 1 | Chebyshev | square |
| `SHAPE_ROUND` | √2 ≈ 1.414 | Euclidean | round (default) |
| `SHAPE_DIAMOND` | 2 | Manhattan | four-pointed diamond |

Any value between blends them continuously — 1.7 is a rounded diamond.

---

## Light radius, and the cost model

**Read this before adding lights to anything new.**

Radius is solved into a decay rate:

```
d = (ambient / intensity) ^ (tileSize / radius)
```

Intensity alone is a poor radius control — reach goes as
`log(ambient / intensity) / log(airDecay)`, which is **logarithmic**: each
doubling of intensity adds a fixed ~150px, and doubling an intensity-1 light's
radius would take intensity 10, long past the point its centre blows out.

### The cost is variety, not quantity

The flood sweeps **all 14,400 tiles** regardless of how many lights are in it, so
every light in one pass propagates simultaneously. But **one sweep has exactly
one decay rate**, and decay *is* radius. Lights needing different radii cannot
share a sweep.

Measured on a desktop Mac:

| lights (1 radius) | cost | | distinct radii (12 lights) | cost |
|---|---|---|---|---|
| 1 | ~0.9 ms | | 1 | 0.88 ms |
| 50 | ~0.9 ms | | 2 | 1.77 ms |
| 500 | ~0.9 ms | | 3 | 2.61 ms |
| 2000 | ~0.9 ms | | 5 | 4.38 ms |

**~0.87ms per additional distinct radius, regardless of light count.** 2000
bullets at one radius are free; five bespoke radii cost 4.4ms with one light each.

This inverts the usual intuition — budget by *how many kinds of light*, not how
many lights.

### Grouping details

Lights are grouped by the **`(shape, decay)`** pair. Decay folds in *both* radius
and intensity, so two lights sharing a radius but differing in intensity land in
**different** groups. Decay is quantised to 0.005 steps, which is roughly a ±1.5%
window on radius — narrow enough that a radius varying continuously (e.g. scaled
from a projectile's `size`) splits groups almost immediately. Snap such a radius
to buckets first.

`LightingRadiusID` in `ID.ts` exists to keep entities sharing passes. Watch
`LightingSystem.GroupCount` when adding lights.

---

## Current configuration

`MainScene.create()` — `{ ambient: 0.10, exposure: 1.0 }`. Everything else default:

| option | default | effect |
|--------|---------|--------|
| `tileSize` | 16 | world px per light tile; smaller = sharper, costlier |
| `airDecay` | 0.93 | open-space decay when no radius is given |
| `solidDecay` | 0.15 | decay through an occluder |
| `ambient` | **0.10** | global light floor |
| `exposure` | 1.0 | highlight rolloff |
| `iterations` | 2 | forward+backward sweep pairs per group |

`LightingRadiusID`: `PlayerRadius = 250`, `ProjectileRadius = 150`.

Emitters:

| entity | hook | intensity | radius |
|--------|------|-----------|--------|
| `Player` | `update()` | 2 | `PlayerRadius` |
| `Bullet` | `AI()` | 0.7 | `ProjectileRadius` |
| `Triangle` | `PostDraw()` | 2 | `PlayerRadius` |
| `Square`, `Pentagon`, `Hexagon`, `Octogon` | `PostDraw()` | 2 | `PlayerRadius * radius / 15` |
| `SuperTriangle`, `SuperSquare`, `SuperPentagon` | `PostDraw()` | 2 | `PlayerRadius * radius / 15` |
| `Diamond`, `SuperHexagon` | `AI()` | 2 | `PlayerRadius * radius / 15` |
| `Dodecahedron` | `AI()` | 2 | `PlayerRadius * radius / 15` |

Enemies use `this.color`, **not** a stored default — the damage flash tints the
*sprite* and leaves `this.color` alone (`Enemy.takeDamage`), so the light does not
strobe white on hits. `Dodecahedron` is the exception: it has its own private
`defaultColor` because it reassigns `this.color` for state changes.

**`ArrowHead` (worm boss) emits no light.** Its segments interpolate radius
(`radiusRatio: lerp(0.78, 0.42, t)` over 9–12 parts), so scaling light radius by
segment radius would create one flood group *per segment* — 8 extra groups, ~7ms,
from a single boss. Give the whole worm one shared radius if adding it.

---

## Known limitations

### Obstacles barely cast shadows

Flood-fill lighting is shortest-path lighting, so light bends around corners.
Great for large contiguous walls; nearly useless for **small convex** obstacles,
because routing around one barely lengthens the path.

Measured against real `MapManager` obstacles (radius 20–40px, ~5 tiles across),
the area directly behind one is only **3–8% darker** than open floor at the same
distance, at any decay settings. Lowering `solidDecay` does not help — it darkens
the obstacle's own silhouette, not the area beyond it.

This is inherent to the model, not a tuning failure; Terraria has the same
property, and a single block casts no real shadow there either. Its darkness
comes from walls dozens of tiles thick. Sharp shadows from small obstacles need a
different technique (analytic shadow cones or raycasting) layered on top.

**Worth knowing:** occlusion is the main reason to pay flood-fill's structural
cost (whole-grid sweeps, radius variety expensive). On this map geometry that
occlusion is worth 3–8%. An analytic light map — same grid, same overlay, same
emission, but each light rasterised into its own bounding box with a distance
formula — would make radius and shape free per light and would likely be cheaper,
at the cost of corner-bending.

### Lights in `AI()` flicker during knockback

`Enemy.ts:562` gates `AI()` on `PreAI() && now >= knockbackEndTime`, and knockback
lasts 100ms (~6 frames). Because lights are immediate-mode, an enemy whose
`AddLight` lives in `AI()` **goes completely dark for those frames every time it
is hit**. `Diamond`, `SuperHexagon` and `Dodecahedron` are currently affected.

`PostDraw()` is not gated and is the correct hook for emitting light.

### `peak update` conflates hitches with sustained cost

`PerfPeaks` stores a max over every frame since reset, so one startup hitch (map
generation, texture baking, a wave spawn) pins it permanently while the smoothed
`fps` never notices. A 42ms peak alongside a steady 60fps means a one-off spike,
not a lighting problem. Treat the live `update` figure as the sustained number and
`peak` only as a "something spiked" flag.

---

## Perf overlay

Add **`?perf=1`** to the URL — it persists in `localStorage`; `?perf=0` clears it.

It is deliberately **not** part of `DevTools`, which early-returns `null` on
mobile — and mobile is where the frame budget actually binds. The flag is
resolved by `initPerfFlag()` in `App.tsx` at boot, *before* the router can drop
the query string (`MainMenu` navigates with a bare `navigate('/game')`).

```
fps              60          below ~58 sustained = dropping frames
update         2.14ms  13%   your logic's share of the 16.67ms frame
└ lighting     1.77ms  11%
light groups        2
peak update    4.82ms
peak lighting  2.03ms
peak groups         3
enemies            37
projectiles        12
```

`update` is the headroom number. `fps` is vsync-locked, so it reads a flat 60
right up until work overruns the frame and then falls to 30 — it tells you the
budget already broke, never how close you are.

Instrumentation is two `performance.now()` calls per frame in
`MainScene.update()`, far below the resolution of anything measured, so it is
unconditional. Only the overlay is gated.

### Measured reality

On-device testing found **lighting is not the bottleneck**. Frame drops tracked
projectile count and enemy count, not `light groups` — 6 groups held 60fps on a
phone. Budget accordingly: the group-count arithmetic above is real, but entity
update cost is what currently limits this game.

---

## Adding a light to a new entity

```ts
import { LightingSystem } from '../../systems/LightingSystem'
import { LightingRadiusID } from '../../data/ID'

PostDraw(): void {
  LightingSystem.AddLight(this.x, this.y, this.color, 2, LightingRadiusID.PlayerRadius)
}
```

1. Emit from **`PostDraw()`**, not `AI()` — see the knockback note above.
2. Reuse a **`LightingRadiusID`** value rather than a bespoke number, and match an
   existing intensity where you can. Both feed the group key.
3. Keep it in the **entity's own hook override**, not in `Enemy`/`Projectile` —
   which classes glow is a per-class decision, matching how the codebase places
   other class-varying behaviour.
4. Load with `?perf=1` and confirm `light groups` did not climb.
