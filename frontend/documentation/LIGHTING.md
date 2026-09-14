# Lighting

A **Terraria-inspired light map**. Light lives on a grid, floods outward tile
by tile, and the result is multiplied over the world as a single full-map
overlay. It is not Phaser's `Light2D`.

**Files:**

| File | Contents |
|------|----------|
| `frontend/src/game/systems/LightingSystem.ts` | The whole system — flood, bake, tone map, overlay |
| `frontend/src/game/systems/MapManager.ts` | Registers occluders + emissive grid/obstacles; owns the albedo colours |
| `frontend/src/game/data/ID.ts` | `LightingIntensityID` — the shared intensity baselines |
| `frontend/src/game/scenes/MainScene.ts` | `BASE_AMBIENT`, `Initialize()`, `UpdateAll()` |
| `frontend/src/game/core/SettingsStorage.ts` | `SETTINGS.brightness` + `SETTINGS_DEFAULTS` |
| `frontend/src/pages/SettingsPage.tsx` | The player-facing Brightness slider |
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

Output is `1 - exp(-light * exposure * brightness)`, not a hard clamp. A clamp
turned every light at or above 1.0 into a flat white disc with a hard edge
(figures below at `brightness` 1):

| light | hard clamp | tone map |
|-------|-----------|----------|
| 1.0 | 1.000 | 0.632 |
| 2.0 | **1.000** | 0.865 |
| 3.0 | **1.000** | 0.950 |

Three very different light levels used to render identically.

---

## Brightness (the player setting) is not `ambient`

Settings has a **Brightness** slider. It does **not** set `ambient`, and the
distinction is the whole point of the feature.

`ambient` is the **floor**. Raising it alone closes the gap between unlit and lit
*without moving the lights*, so every torch loses contrast against its
surroundings until the frame is uniform haze — the "the brighter I make it, the
less my lights do" failure.

What a brightness control wants is to scale the **whole image**: ambient, every
emitter, and every baked emission, together, so the ratio between lit and unlit
is untouched and only the overall level moves.

That turns out to be **one multiply**, because everything between the emitters
and the tone map is **linear** in light value:

| step | why it is linear |
|------|------------------|
| `seed` / `merge` / emission | take a max — `max(kA, kB) = k·max(A, B)` |
| `spread` | multiplies by a decay — `(kA)·d = k·(A·d)` |
| the buffer pre-fill | filled with `ambient`, so scaling ambient scales the floor |

So scaling every input by `brightness` scales every tile of `light` by exactly
`brightness`, and the only non-linear step is the tone map:

```
1 − exp(−(light × brightness) × exposure)  ≡  1 − exp(−light × (exposure × brightness))
```

`brightness` is therefore applied as an **exposure multiplier in `upload()`** —
one multiply per frame rather than one per light — and is pixel-for-pixel
identical to scaling `ambient` and every `AddLight` call by hand.

Two things deliberately do **not** move with it:

- **Reach.** A light's reach comes from `intensity / ambient`, and scaling both
  leaves that ratio alone. Lights are the same *size* at every brightness, just
  brighter — a slider that resized every light would change what the player can
  see coming.
- **Cost.** Nothing about it splits a flood group or adds a pass.

### The slider → multiplier mapping

The slider is expressed in the units a player understands — **the ambient level
it is asking for, 5%–100%** — and `MainScene` converts:

```ts
const BASE_AMBIENT = 0.10   // the ambient the game is AUTHORED at

LightingSystem.Initialize(this, {
  ambient: BASE_AMBIENT,
  exposure: 1.0,
  brightness: SETTINGS.brightness / BASE_AMBIENT
})
```

| slider | target ambient | multiplier | look |
|--------|---------------|------------|------|
| 5% | 0.05 | 0.5× | moodier than authored |
| **10%** | **0.10** | **1.0×** | **the authored look (default)** |
| 30% | 0.30 | 3× | bright; lights near the tone map's ceiling |
| 100% | 1.00 | 10× | deliberately flat, fully lit |

What this does *not* dodge is the tone map's own ceiling. Past roughly **3×**,
lights are already pinned at white and only the ambient floor is still climbing,
so contrast does start falling again — just far later, and far more gently, than
raising `ambient` on its own. The 100% end is a "just let me see" option, not a
good-looking one.

> **Applied at scene start.** `Initialize()` runs in `MainScene.create()`, so a
> change takes effect on the next run. `LightingSystem.SetBrightness()` is safe
> to call at any time and lands the same frame — reach for it if Settings ever
> becomes reachable from the pause menu.
>
> The slider floors at 5, not 0: at 0 the world is pitch black with no way back
> to the settings page from inside the game.

`SETTINGS_DEFAULTS` in `SettingsStorage.ts` is the single source of truth for the
default (10) — the getters' `??` fallbacks, the seed for a new settings blob, and
the per-slider **Default** buttons all read it.

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

The unlit column is at the default brightness; the player's slider scales it
along with everything else.

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

> The occluder mask is a `Uint8Array` and there is **no per-tile decay array
> beside it**. With one global decay rate a tile's decay is one of exactly two
> numbers, so `propagate()` carries `air`/`solid` (and their `^shape` diagonal
> versions) as four scalars and branches on the mask. The per-tile version cost a
> 14,400-entry rebuild with a `Math.pow` per tile, *per group, per frame*.
>
> The mask was always separate rather than inferred from those decay values, for
> a reason worth keeping: `Float32Array` stores `0.93` as `0.9300000071525574`,
> so comparing an entry back against the float64 `airDecay` is never equal and
> every tile silently reports "solid" — which would delete the entire grid glow.

---

## API

Static, matching the `Particle` pool convention.

```ts
// Once in MainScene.create() — BEFORE generateMap(), which bakes into it
LightingSystem.Initialize(this, {
  ambient: BASE_AMBIENT,                          // 0.10, the authored look
  exposure: 1.0,
  brightness: SETTINGS.brightness / BASE_AMBIENT  // the player's slider
})

// Global brightness, changeable any time — lands the same frame, costs nothing
LightingSystem.SetBrightness(multiplier)
LightingSystem.Brightness  // -> current multiplier

// MapManager.bakeLighting() does these
LightingSystem.SetOccluders(obstacleData)
LightingSystem.BakeLight(x, y, color, intensity, radius?, skipSolid?)
LightingSystem.ClearBaked()

// Any entity, any frame, any hook. Intensity is the ONLY size control.
LightingSystem.AddLight(x, y, color, intensity, shape?)

// Authoring helpers for picking an intensity — see the section below
LightingSystem.Reach(intensity)      // -> world px
LightingSystem.IntensityFor(radius)  // -> intensity

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

## Intensity is the only knob

**Read this before adding lights to anything new.**

**There is no per-light radius.** A sweep has exactly one decay rate, and decay is
what sets how far light travels, so a light asking for its own radius asks for
its own full-grid flood pass.

An earlier version *did* offer one, and it is worth knowing how that went. The
ArrowHead boss taper (`ArrowHeadConfig.radiusRatio` lerps 0.78 → 0.42) meant each
of its 12 segments derived a different radius, so a single boss cost **12 flood
passes and ~12.5ms a frame** — 84% of the frame budget, on wave 1.

So, as in Terraria: one global `airDecay`, and reach emerges from how much
brightness a light injects.

```
reach = tileSize * ln(ambient / intensity) / ln(airDecay)
```

### What that buys, and what it costs

**Light count and brightness are both free.** 2000 lights at 40 different
intensities cost exactly one pass, the same as one light. Vary intensity per
entity as freely as you like — that is what the enemies do
(`LightingIntensityID.Entity * this.radius / 25`), and it costs nothing.

**Reach is logarithmic in intensity**, so size is the expensive axis:

| intensity | 0.5 | 0.7 | 1 | 2 | 4 | 8 | 40 |
|---|---|---|---|---|---|---|---|
| reach (px) | 134 | 162 | 192 | **249** | 307 | 364 | 498 |
| centre (tone-mapped) | 0.39 | 0.50 | 0.63 | **0.86** | 0.98 | 1.00 | 1.00 |

Doubling intensity adds a flat **~58px**, every time. Going 250px → 500px costs
**20× the intensity**.

Reach is brightness-independent; the centre row is at the default brightness and
saturates sooner as the player raises it.

Note the two rows saturating at different rates. That is the thing to internalise:

- **Below ~2**, intensity is mostly a **brightness** control — the centre climbs
  fast, the radius barely moves.
- **Above ~3**, the centre is pinned at white and intensity is mostly a **size**
  control, bought at a steep exchange rate.

Physically that is correct — a brighter lamp *does* blow out its core and spread
its glow — but it means **you cannot make a light much bigger without making it
look blown out.** If you want everything bigger, move `airDecay`. If you want to
change the shape of the curve itself, move `ambient`: it sets the `−ln(ambient)`
constant, and raising it widens the reach spread across a given intensity range.

Both are **authoring** knobs that rebalance the whole roster. To make the game
merely *brighter*, that is `brightness` — it leaves this entire table alone.

Use `LightingSystem.Reach(i)` and `LightingSystem.IntensityFor(px)` rather than
eyeballing this. `LightingIntensityID` in `ID.ts` holds the shared baselines.

### Grouping details

Lights are grouped by **`shape` alone**. Every light in the game uses
`SHAPE_ROUND`, so the game runs at **one flood pass**, always — regardless of
light count, intensity, or what is on screen. Only introducing a second *shape*
adds a pass. Watch `LightingSystem.GroupCount`; if it is ever above 1, something
passed a custom shape.

### Viewport culling: the other half of the budget

Total cost is **groups × window area**. Group count is above; this is the
other factor, and it is why cost tracks the *screen* and not the world.

Two independent mechanisms, both automatic:

**Emitter culling.** `AddLight` drops any light whose reach cannot touch the
padded camera rect — an off-screen enemy emits nothing, the same rule Terraria
uses. Callers never need an on-screen check; call `AddLight` unconditionally.
This matters more than the raw saving suggests, because a dropped light also
cannot open a **flood group** of its own.

**Flood windowing.** Every buffer pass — clear, seed, sweep, merge, upload —
runs over a tile window around the camera rather than the whole grid.

The window is the camera rect grown by `cullPadding` **plus the distance of the
furthest surviving emitter outside the view**. Note what that margin is *not*:
it is not the largest light **radius**. A light inside the view needs no margin
at all, because the flood only has to be correct where it is visible — what that
light does off-screen is never sampled. Sizing the margin by radius would grow
the window past the whole grid at current settings and save nothing.

Measured (desktop Mac, 2560×1440 world, 1280×720 camera):

| scenario | per-light radius, full grid | one decay, full grid | one decay + culling | window |
|---|---|---|---|---|
| ArrowHead boss on screen (12 segments) | 12.48 ms | 0.97 ms | **0.36 ms** | 37% |
| 12 enemies + player + 20 bullets, spread over world | 2.01 ms | 1.00 ms | **0.84 ms** | 84% |

Killing the radius parameter did the heavy lifting (12 passes → 1); culling then
took another 2.7x off the boss case. Net **35x** on the case that was actually
dropping frames.

The second row is the honest limit of *culling specifically*: **this world is
only 2× the camera in each axis**, and scattered enemies mean some survivor is
usually a few hundred px off-screen, which pushes the window back out. Windowing
is a huge win in Terraria because its world is ~100× its screen; here it pays off
mainly when the lights that matter are the ones you are looking at — which is
exactly the boss case.

`PerfStats.lightWindow` and the `flood window` / `lights` rows on the perf
overlay report this live.

---

## Current configuration

`MainScene.create()` — `{ ambient: BASE_AMBIENT, exposure: 1.0, brightness: … }`.
Everything else default:

| option | default | effect |
|--------|---------|--------|
| `tileSize` | 16 | world px per light tile; smaller = sharper, costlier |
| `airDecay` | **0.825** | open-space decay — the GLOBAL size control for every light |
| `solidDecay` | 0.15 | decay through an occluder |
| `ambient` | **0.10** | global light floor (`BASE_AMBIENT`, the authored look) |
| `exposure` | 1.0 | highlight rolloff |
| `brightness` | **player setting** | scales ambient *and* every light together — see above |
| `iterations` | 2 | forward+backward sweep pairs per group |
| `cullPadding` | 96 | world-px slack around the camera for viewport culling |

`ambient` and `brightness` are the pair to keep straight: **`ambient` is an
authoring value and `brightness` is the player's.** Retuning the game's look
means moving `BASE_AMBIENT` (and rebalancing every intensity against it);
letting a player see more means the slider, which leaves that balance intact.

`airDecay = 0.825` is chosen so intensity 2 reaches ~250px and intensity 0.7
reaches ~160px — where entity and projectile lights sat under the old per-light
radius parameter. Lower it to shrink every light at once.

`LightingIntensityID`: `Entity = 2` (~250px), `Projectile = 0.7` (~160px),
`Player = 1.2` (~207px) — a deliberate override so the player's own glow does not
out-reach the enemies it is meant to reveal — and `Explosion = 1.3`.

Emitters — all reach `Reach(intensity)` px, all in one flood pass:

| emitter | hook | intensity |
|---------|------|-----------|
| `Player` | `update()` | `Player` (1.2) |
| **Enemies** | | |
| `Triangle` | `PostDraw()` | `Entity` — no size scaling |
| `SuperTriangle` | `PostDraw()` | `Entity * radius / 25` |
| `Square`, `Pentagon`, `Hexagon`, `Octogon`, `Diamond` | `PostDraw()` | `Entity * radius / 35` |
| `SuperSquare`, `SuperPentagon`, `SuperHexagon`, `SuperOctogon` | `PostDraw()` | `Entity * radius / 35` |
| `SeekingSquare`, `Dodecahedron` | `PostDraw()` | `Entity * radius / 35` |
| `SuspiciousSquare` | `PostDraw()` | `Entity * radius / 55` — dimmer on purpose |
| `ArrowHeadHead`, `ArrowHeadPart`, `ArrowHeadTail` | `PostDraw()` | `Entity * radius / 35` |
| **Player projectiles** | | |
| `Bullet` | `AI()` | `Projectile * size / 5` |
| `HomingBullet` | `PostDraw()` | `Projectile * size / 6` |
| `BuckshotPellet` | `PostDraw()` | `Projectile * size / 3` |
| `ExplosiveBullet` | `PostDraw()` | `Explosion * size / 7` |
| `BulletExplosion` | `PostDraw()` | `Explosion * (size / 7) * alpha` |
| **Enemy projectiles** | | |
| `EnemyBullet`, `DodecahedronBullet`, `SuperHexagonProj`, `ArrowHeadBodyProj` | `PostDraw()` | `0.85` literal |
| `AcidBullet` | `PostDraw()` | `1.2` literal |
| `AcidExplosion` | `PostDraw()` | see call site |
| `SuperPentagonExplosion` | `PostDraw()` | `Explosion * (size / 40) * alpha` |
| `SuperPentagonExplosionDetonation` | `PreDraw()` | `1.7` literal |
| **Other** | | |
| `BasicParticles` | `PostDraw()` | `Projectile * radius / 2.5 * alpha` |
| `PolygonParticle` | `PostDraw()` | `Projectile * radius / 10 * alpha` |
| `DroppedUpgradeBundle` | `PostDraw()` | `upgradeValue + 1` — rarity drives the glow |

Size scaling is carried by **intensity**, so bigger enemies glow both brighter
and wider — and it is free, since intensity does not split passes. Fading
emitters multiply by `sprite.alpha` so the light dies with the sprite.

The divisor is a size dial for the whole roster. Because reach is logarithmic,
**changing it shifts every enemy's reach by the same flat amount** rather than
scaling them: 25 → 35 took ~28px off every enemy regardless of size. A radius-25
enemy sits at ~221px and a radius-46 boss head at ~272px. `Triangle` and
`SuperTriangle` are deliberately left out of the 35 group.

Enemies use `this.color`, **not** a stored default — the damage flash tints the
*sprite* and leaves `this.color` alone (`Enemy.takeDamage`), so the light does not
strobe white on hits. `Dodecahedron` is the exception: it has its own private
`defaultColor` because it reassigns `this.color` for state changes.

**`ArrowHead` (worm boss) now emits from every segment**, and that is safe only
because intensity stopped being a grouping key. Its segments interpolate radius
(`radiusRatio: lerp(0.78, 0.42, t)` over 9–12 parts), so each one scales `Entity`
by a *different* number — which under the old per-light radius parameter meant
one flood group per segment, 11–12 groups and ~12.5ms from a single boss. Under
the current API that is 1 group and 0.36ms. See *Measured reality* below.

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

`Enemy.ts:572` gates `AI()` on `PreAI() && now >= knockbackEndTime`, and knockback
lasts 100ms (~6 frames). Because lights are immediate-mode, an enemy whose
`AddLight` lives in `AI()` **goes completely dark for those frames every time it
is hit**.

**No enemy is currently affected** — every one emits from `PostDraw()`, which is
not gated and is the correct hook. `Diamond`, `SuperHexagon` and `Dodecahedron`
used to emit from `AI()` and have since been moved. The one remaining `AI()`
emitter is `Bullet`, which is a projectile and so is not knockback-gated at all.

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
lights         18 lit / 6 culled   viewport culling; 0 culled = it did nothing
flood window   66% of grid         multiplies the cost of EVERY group
peak update    4.82ms
peak lighting  2.03ms
peak groups         3
enemies            37
projectiles        12
```

Read `light groups` and `flood window` together — they multiply. 6 groups over a
third of the grid costs what 2 groups over all of it does.

`update` is the headroom number. `fps` is vsync-locked, so it reads a flat 60
right up until work overruns the frame and then falls to 30 — it tells you the
budget already broke, never how close you are.

Instrumentation is two `performance.now()` calls per frame in
`MainScene.update()`, far below the resolution of anything measured, so it is
unconditional. Only the overlay is gated.

### Measured reality

Early on-device testing suggested lighting was not the bottleneck: 6 groups held
60fps on a phone while frame drops tracked projectile and enemy count.

**That conclusion did not survive giving the ArrowHead boss lighting.** Its
segments taper (`ArrowHeadConfig.radiusRatio` lerps 0.78 → 0.42), and the enemy
call site derives radius from `this.radius`, so **every segment landed in its own
flood group** — 11–12 groups from a single boss, with lighting at ~84% of a 14ms
frame on wave 1. The group-count arithmetic above predicted it exactly.

**That is what killed the radius parameter.** A per-light radius is a per-light
flood pass, and a multi-part entity multiplies that by its part count — the API
made the expensive thing look free. With one global decay the same boss costs one
pass and 0.36ms, and there is no longer a way to write that bug.

The current numbers, on the same desktop Mac: **0.36ms** for the boss, **0.84ms**
for a scattered wave-10-ish load, both at 1 group. Whether entity and projectile
update cost is now the binding constraint is still open — see next steps.

---

## Adding a light to a new entity

```ts
import { LightingSystem } from '../../systems/LightingSystem'
import { LightingIntensityID } from '../../data/ID'

PostDraw(): void {
  LightingSystem.AddLight(this.x, this.y, this.color, LightingIntensityID.Entity)
}
```

1. Emit from **`PostDraw()`**, not `AI()` — see the knockback note above.
2. **Pick any intensity you like.** It is free: it does not split a flood pass,
   and off-screen emitters are culled for you, so there is no on-screen check to
   write. Start from a `LightingIntensityID` baseline and scale it; use
   `LightingSystem.Reach(i)` if you want to know what that is in pixels.
3. Keep it in the **entity's own hook override**, not in `Enemy`/`Projectile` —
   which classes glow is a per-class decision, matching how the codebase places
   other class-varying behaviour.
4. Do **not** pass a custom `shape` unless you mean it — that is the one argument
   that costs a pass. Load with `?perf=1` and confirm `light groups` is still 1.
