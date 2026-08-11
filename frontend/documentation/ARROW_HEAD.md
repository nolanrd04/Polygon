# Arrow Head (boss)

A multi-part worm boss. The head and every segment are **separate enemies** —
each with its own container, sprite, hitbox and registry id — chained together
so they animate as one animal.

Directly modeled on tModLoader's `Worm` / `WormHead` / `WormBody` / `WormTail`
split (`ExampleMod/Content/NPCs/ExampleWorm.cs`), including the shared health
pool (`NPC.realLife`) and the "segments have no AI, they just sit behind their
leader" rule.

**Files:** `frontend/src/game/entities/enemies/ArrowHead/`

| File | Contents |
|------|----------|
| `ArrowHeadConfig.ts` | Every tunable. Shape math, stat curves, chain rules, timings, drops |
| `ArrowHeadPart.ts` | Shared base — shape rendering, chain links, damage routing, death FX |
| `ArrowHeadHead.ts` | The only part with AI. Spawns the chain, owns all stats, drives the chain |
| `ArrowHeadBody.ts` | Middle link. No AI |
| `ArrowHeadTail.ts` | Last link. `ArrowHeadBody` at the far end of every curve |
| `index.ts` | Barrel export |

Registry ids: `arrow_head`, `arrow_head_body`, `arrow_head_tail`. Only
`arrow_head` is ever spawned by a wave — it spawns the other two itself.

---

## The shape

Every part is a four-vertex arrow — **tip, right barb, rear, left barb** — built
through `TextureGenerator.getOrCreateIrregularPolygon()`.

The knob that decides the shape family is `backRatio`: how far the rear vertex
sits out, **measured against the line joining the two barbs**.

| `backRatio` | Result | Used by |
|---|---|---|
| `< 1` | rear cut in past the barbs → **concave arrow** (`^`) | body segments |
| `= 1` | rear on the barb line → triangle | — |
| `> 1` | rear pushed out past the barbs → **convex kite** | head, tail |

Measuring against the barb line rather than using a raw radius is deliberate.
The real condition for concavity is

```
rear < barbRadius * cos(halfSpread)
```

not `rear < barbRadius`. A raw radius silently flips a concave arrow convex as
soon as `halfSpread` widens — which is exactly what happened during development
when the segment curve widened the spread toward the tail. As a ratio, the
shape family is whatever `backRatio` says at every spread.

`chevronGeometry()` converts a `ChevronShape` into the `angles` / `vertexRadii`
pair the texture generator wants. Walking tip → right barb → rear → left barb
gives central angles that always sum to 360:

```
(180 - halfSpread) + halfSpread + halfSpread + (180 - halfSpread) = 360
```

so the outline is valid for any spread, in either shape family.

---

## The chain

```
head ──> body ──> body ──> … ──> tail
     follower        follower        follower
```

Each part holds `leader` / `follower` links plus `owner` (the head — tModLoader's
`realLife`). Body/tail parts return `false` from `PreAI()`, so the base class
skips both the default move-toward-player and `AI()` entirely.

**The head drives every part's position**, front to back, in `UpdateChain()`.
This differs from tModLoader, where each segment pulls itself toward its leader
on its own tick — and the reason is `EnemyManager.update()` iterates its enemy
array **backwards**. A segment updating itself would always read its leader's
*previous-frame* position, and that one-frame lag would compound down the chain.

### Spacing

Spacing is derived from the two parts' actual outlines, not their radii:

```
gap = leader.rearExtent + my.forwardExtent - (my.forwardExtent * overlapRatio)
```

A radius-based ratio can't serve this worm, because a kite reaches roughly
**twice as far back** as a concave arrow of the same radius (its rear vertex
protrudes; the arrow's is cut in). One ratio that spaces the head-to-body join
correctly leaves the body-to-body joins with visible gaps, and vice versa.

Deriving from the outline means `overlapRatio` reads as what it is — how deeply
each part buries into the one ahead, as a fraction of its own nose — and every
join lands at exactly that fraction at any chain length. Change a shape in the
config and the spacing re-solves itself.

`spacingBetween()` in `ArrowHeadConfig.ts` is shared by the head's initial
placement and the per-frame follow so the two can never disagree.

### Facing

Parts point their tip at their leader, plus `chain.facingOffsetDeg` for their
role. The tail uses **180°**, turning it around to point back down the worm so
the boss is capped by an arrow opposing the head rather than a second one
pointing along with it.

Spacing is reversal-aware: a flipped part reaches toward its leader with its
*rear*, not its tip, and on a kite those differ by more than 50%. The tail's
joint gap widens from 24.0px to 30.4px because of the flip — without that,
it would bury 8.4px deeper than the configured overlap asks for.

Overlapping parts also mean draw order is part of the silhouette:
`chain.depthPerPart` steps each part slightly under the one ahead of it.

---

## The head owns every statistic

Segments define almost nothing themselves. `ConfigureAsSegment()` derives their
radius, damage, defense, hitbox, color and health from the head, and it runs
through `EnemyManager.spawnEnemy()`'s `configure` hook — **after** `SetDefaults()`
and wave scaling, **before** `_spawn()`:

- scaling has already been applied to the head, so stats derived from it are
  scaled exactly once (deriving before scaling would double-scale them)
- nothing has been built yet, so radius/scale/hitbox changes are picked up by
  `_spawn()` normally, with no rebuilding afterwards

Per-segment values are **functions of `t`** (0 = first part behind the head,
1 = last part), not tables, so the curves hold at any chain length.

Appearance (shape + radius) uses a **quantized** `t` — `segment.textureSteps`.
Textures are cached by their full geometry, so a chain length rolled per spawn
would otherwise produce a fresh set of `t` values, and a fresh set of textures
to bake, every single time a worm spawned. Quantizing collapses chain lengths
7–11 down to 9 shared textures total. Stats stay continuous.

---

## Health and damage

With `chain.sharedHealth` (default), damage to **any** part routes into the
head's pool. The worm has one health bar, dies as one enemy, and reports one
kill. `ArrowHeadPart.takeDamage()` does the routing:

1. the struck part's own `OnHit` runs (flash, sound, invulnerability)
2. the struck part's `defense` is applied — it's the part that got hit, so its
   armor is the armor that matters
3. the head's own `defense` is added back before forwarding, since
   `Enemy.takeDamage()` will subtract it again, so the pool loses exactly what
   the struck part let through

When the head dies, `OnDeath()` dissolves the chain back-to-front
(`fx.deathStaggerMs`). Segments are removed with `_destroy()`, **not** a death —
only the head emits `enemy-killed`, so scoring and wave validation see one enemy.

Set `chain.sharedHealth = false` to make every part separately killable with its
own health (`chain.soloHealthRatio`); the chain re-stitches around whatever dies.

### Contact damage

Every part is its own enemy, and `CollisionManager` gates contact damage
per-enemy — so a worm sweeping through the player would bill them **once per
part it drags across**, which on a long chain is an instant kill rather than a
hit. `chain.sharedContactCooldown` propagates the newest hit time across the
whole chain each frame, so any one part connecting puts the entire worm on
cooldown.

---

## Movement

Turn-rate limited rather than homing: the head can only rotate
`head.turnRateDeg` degrees per second, so it carves wide arcs, overshoots the
player and has to come back around. Charging (`combat.charge`) multiplies speed
and *drops* the turn rate, committing it to a line.

### Far movement (long-range re-approach)

When the player gets more than `head.farMovement.minDistanceFromPlayer` away —
usually by baiting a charge and dodging so the committed lunge carries the worm
off — the head speeds up (`speedMultiplier`, eased in at its own, much higher
`accelerationPerSec`) and steers for a point *beside* the player rather than at
them, so it arcs back into range instead of nosing straight in.

Three things about this are load-bearing:

- **The aim offset must be angular, not radial.** A point pushed further out
  along the head-to-player line is collinear with both, so it yields the exact
  same bearing as aiming at the player and changes nothing. `orbitOffsetDeg`
  rotates the aim point *around* the player, which is what puts a lateral
  component in the heading.
- **`Vector2.rotate()` pivots about the world origin.** The offset is rotated
  first and the player's position added after; adding first spins the player's
  absolute map coordinate around the corner of the world.
- **Entry and exit use different distances.** `resumeDistanceFromPlayer` sits
  well under `minDistanceFromPlayer`; with one shared threshold the head flips
  modes every few frames on the boundary, re-rolling its orbit direction each
  time and twitching in place.

`orbitSide` is chosen once on entry, picking whichever side needs the smaller
turn from the current heading so the head flows into the arc instead of first
reversing its rotation. Charging suppresses the whole behaviour (the charge is
its own committed movement) but does not touch its timers.

Note the threshold interacts with the camera: it follows the player at zoom 1,
so nothing further than the viewport half-diagonal — 734px at 1280x720 — is
ever on screen. A threshold above that plays the entire behaviour out of frame.

### Charge range scaling

A charge runs for `combat.charge.durationMs` at close range, but past
`minDistance` its duration is stretched by `chargeDurationFor()` so the lunge
actually arrives instead of falling short from across the arena.

The extra time is bought at *full charge speed* rather than by scaling the whole
duration, because the head spends its first ~0.75s accelerating from cruise up
to `speed * speedMultiplier`, and that ramp is a fixed cost paid once at launch
regardless of range. Scaling proportionally would re-pay it and overshoot badly
at distance; adding only `(distance - minDistance) / chargeSpeed` holds the
overshoot constant at ~200px everywhere, so a long charge feels like a
close-range one that simply travels further.

Range is sampled once when the charge launches, not tracked per frame — the
charge is a commitment to where the player *was*, so a fleeing player can't
stretch it into a homing chase. `maxDurationMs` caps it, since an uncapped
diagonal charge runs ~6.8s during which the head barely turns and (with
`volley.skipWhileCharging`) never shoots.

All movement is delta-based off `scene.game.loop.delta` (clamped to 50ms), not
frame-counted — the game loop runs at display refresh, so frame-counted motion
runs at double speed on a 120Hz display. See PARTICLE.md's notes on the same trap.

`head.worldMargin` steers the head back toward the world center once it
overshoots far enough outside the world bounds, so a bad arc can't park the
boss off-screen.

---

## Tuning

Everything lives in `ArrowHeadConfig.ts`. Nothing about the boss is hardcoded
anywhere else.

| Want to change | Edit |
|---|---|
| Worm length | `chain.bodySegments` (min/max) |
| How much parts overlap | `chain.overlapRatio` |
| Which way a part faces | `chain.facingOffsetDeg` (tail is 180°) |
| Total health / damage / armor | `head.*` — segments re-derive automatically |
| Segment taper (size, damage, color) | `segment.radiusRatio` / `damageRatio` / `tailColor` |
| The arrow outlines | `head.shape`, `segment.shapeFor` |
| One health bar vs. killable segments | `chain.sharedHealth` |
| Attacks | `combat.charge`, `combat.volley` |
| Which waves it appears on | `SCHEDULED_BOSS_SPAWNS` in `systems/difficulty/Normal.ts` |

---

## Backend

The anti-cheat validates reported enemy types and derives required damage from
server-side base health, so `backend/app/core/data/enemies.json` carries
matching entries (`arrow_head` at 9500 base health, boss-only), and
`difficulty_normal.json` mirrors the boss schedule. **`head.health` in the
config and `base_health.arrow_head` in `enemies.json` must stay in sync** or
damage validation will flag every wave the boss appears on.

Segments are registered too (score and bundle chance 0), so flipping
`chain.sharedHealth` off doesn't start reporting enemy types the backend
rejects.
