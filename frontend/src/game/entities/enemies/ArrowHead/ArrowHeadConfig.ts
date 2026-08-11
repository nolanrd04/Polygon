import Phaser from 'phaser'
import { BundleRarity } from '../../../data/ID'

/**
 * ============================================================================
 * ARROW HEAD - CONFIGURATION
 * ============================================================================
 *
 * Every tunable number for the Arrow Head boss lives in this file. Nothing
 * about the worm is hardcoded anywhere else: the other Arrow Head files read
 * their shape, stats, chain length, colors and timings from here, and derive
 * every segment's stats from the head's *post-difficulty-scaling* stats.
 *
 * That means:
 *  - Change `head.health` and the whole worm's health pool changes.
 *  - Change `chain.bodySegments` and the worm gets longer or shorter, with
 *    sizes, colors, damage and spacing all re-derived to match.
 *  - Change `head.shape` / `segment.shapeAt` and every part's texture,
 *    hitbox and death particles follow.
 *
 * The per-segment values are *functions of `t`*, not tables, so the worm
 * stays correct at any length. `t` is the position along the chain:
 * `t = 0` is the segment directly behind the head, `t = 1` is the last part
 * (the tail, when one is enabled).
 */

/**
 * Registry ids for the three parts. These are the strings registered in
 * `enemies/index.ts` and the strings the head passes to
 * `EnemyManager.spawnEnemy()` when it builds its own chain.
 */
export const ARROW_HEAD_IDS = {
  head: 'arrow_head',
  body: 'arrow_head_body',
  tail: 'arrow_head_tail',
} as const

export type ArrowHeadRole = keyof typeof ARROW_HEAD_IDS

// ============================================================================
// SHAPE - THE CONCAVE ARROW ("^")
// ============================================================================

/**
 * A four-vertex arrow — tip, right barb, rear, left barb — described in terms
 * that are meaningful to look at rather than as a raw vertex list.
 *
 * The one knob that decides what family of shape you get is `backRatio`: how
 * far out the rear vertex sits, measured against the line joining the two
 * barbs. Below 1 the rear is cut in past that line and the outline is a
 * concave arrow; above 1 it pushes out past it and the outline is a convex
 * kite. Both are drawn from the same four vertices.
 *
 *   backRatio < 1          backRatio = 1         backRatio > 1
 *   concave arrow          triangle              kite
 *
 *        /\                     /\                    /\
 *       /  \                   /  \                  /  \
 *      /    \                 /    \                /    \
 *     /  /\  \               /      \              L      R
 *    L__/  \__R             L________R              \    /
 *                                                    \  /
 *      rear cut in           rear on the              \/
 *      past the barbs        barb line              rear pushed out
 *
 * Expressing the rear vertex as a *ratio of the barb line* rather than as its
 * own radius is deliberate: the real condition for concavity is
 * `rear < barbRadius * cos(halfSpread)`, not `rear < barbRadius`, so a raw
 * radius silently flips concave shapes convex as soon as `halfSpread` widens.
 * As a ratio, the shape family is whatever `backRatio` says it is at every
 * spread.
 */
export interface ChevronShape {
  /** Degrees from the rear vertex out to each barb. Small = narrow dart, large = wide flare. */
  halfSpread: number
  /** Tip distance from center, as a multiple of the part's radius. */
  tipRadius: number
  /** Barb distance from center, as a multiple of the part's radius. */
  barbRadius: number
  /** Rear vertex position, as a multiple of the barb line. < 1 = concave arrow, > 1 = kite. */
  backRatio: number
}

/**
 * Convert a {@link ChevronShape} into the `angles` / `vertexRadii` pair that
 * `TextureGenerator.getOrCreateIrregularPolygon()` takes.
 *
 * That generator uses a fan-of-triangles parameterisation: `angles[i]` is the
 * central angle swept from vertex `i` to vertex `i + 1`, and the array is
 * normalised to total 360°. Walking tip -> right barb -> rear -> left barb ->
 * back to tip gives central angles that already sum to exactly 360, so the
 * outline is valid for any `halfSpread`:
 *
 *   (180 - halfSpread) + halfSpread + halfSpread + (180 - halfSpread) = 360
 *
 * Every vertex is anchored to the center, so the outline always closes —
 * concave and convex are both representable, and neither can be malformed.
 */
/**
 * How far the shape reaches *forward* of its center, as a multiple of radius.
 * That's the tip, always.
 */
export function forwardExtent(shape: ChevronShape): number {
  return shape.tipRadius
}

/**
 * How far the shape reaches *behind* its center, as a multiple of radius.
 *
 * Which vertex is rearmost depends on the shape family, which is exactly what
 * makes a radius-based spacing rule wrong: on a kite (`backRatio` > 1) it's
 * the rear vertex, but on a concave arrow the rear vertex is cut in and the
 * *barbs* trail furthest back. A kite therefore reaches roughly twice as far
 * back as an arrow of the same radius, and spacing has to know that or the
 * part behind it ends up buried.
 */
export function rearExtent(shape: ChevronShape): number {
  const spread = Phaser.Math.Clamp(shape.halfSpread, 5, 88)
  const barbLine = shape.barbRadius * Math.cos(Phaser.Math.DegToRad(spread))
  return barbLine * Math.max(shape.backRatio, 1)
}

export function chevronGeometry(shape: ChevronShape): { angles: number[]; vertexRadii: number[] } {
  // Kept under 90 so the barbs stay ahead of the rear vertex; past that the
  // "barbs" would swing behind it and the arrow reading breaks down.
  const spread = Phaser.Math.Clamp(shape.halfSpread, 5, 88)

  // Distance from the center down to the barb line, which is what backRatio
  // is measured against.
  const barbLine = shape.barbRadius * Math.cos(Phaser.Math.DegToRad(spread))

  return {
    // tip -> right barb, right barb -> rear, rear -> left barb, left barb -> tip
    angles: [180 - spread, spread, spread, 180 - spread],
    vertexRadii: [shape.tipRadius, shape.barbRadius, barbLine * shape.backRatio, shape.barbRadius],
  }
}

// ============================================================================
// SMALL HELPERS (used by the derivation functions below)
// ============================================================================

/** Linear interpolation with `t` clamped to 0..1. */
export function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * Phaser.Math.Clamp(t, 0, 1)
}

/** Snap `t` to one of `steps + 1` evenly spaced values in 0..1. */
export function quantize(t: number, steps: number): number {
  if (steps <= 0) return t
  return Math.round(Phaser.Math.Clamp(t, 0, 1) * steps) / steps
}

/** Blend two 0xRRGGBB colors. Used to run a gradient down the chain. */
export function blendColor(from: number, to: number, t: number): number {
  const blended = Phaser.Display.Color.Interpolate.ColorWithColor(
    Phaser.Display.Color.IntegerToColor(from),
    Phaser.Display.Color.IntegerToColor(to),
    100,
    Phaser.Math.Clamp(t, 0, 1) * 100
  )
  return Phaser.Display.Color.GetColor(blended.r, blended.g, blended.b)
}

// ============================================================================
// THE CONFIG
// ============================================================================

export const ArrowHeadConfig = {
  /**
   * ------------------------------------------------------------------------
   * HEAD - the statistics authority for the whole worm.
   * ------------------------------------------------------------------------
   * These are pre-difficulty-scaling base stats, exactly like any other
   * enemy's SetDefaults(). EnemyManager scales health/damage/speed by the
   * wave curve before the head ever builds its chain, and the segments are
   * derived from the *scaled* result — so segments never get double-scaled.
   */
  head: {
    health: 20000,
    damage: 120,
    defense: 45,
    /** Cruise speed in px/sec. */
    speed: 165,
    /** Difficulty speed multiplier cap. 1 = speed never scales with waves (boss behaviour). */
    speedCap: 1,
    /** How fast the head can change direction, in degrees/sec. Low = wide, worm-like arcs that overshoot the player. */
    turnRateDeg: 115,
    /** How fast the head approaches its target speed, in px/sec². */
    accelerationPerSec: 420,
    radius: 46,
    /** Collision radius as a fraction of `radius`. A chevron doesn't fill its circle, so keep this under 1. */
    hitboxSize: 0.72,
    color: 0xff4d2e,
    scoreChance: 1,
    bundleDropChance: 1,
    knockbackResistance: 1,
    barWidth: 70,
    barHeight: 8,
    /** Damage is ignored for this long after spawning, while the chain builds itself. */
    spawnImmunityMs: 900,
    /** Scale the head is born at; tweens down to 1 over `spawnImmunityMs`. */
    spawnScale: 1.35,
    /** Kite: rear vertex pushed out past the barb line, tip still the longest point. */
    shape: {
      halfSpread: 50,
      tipRadius: 1.0,
      barbRadius: 1.0,
      backRatio: 1.3,
    } as ChevronShape,
    /**
     * Once the head leaves the world by more than this many pixels it steers
     * for the world center instead of the player, so a bad overshoot can't
     * park the boss off-screen. Bounds themselves come from GameConfig.
     */
    worldMargin: 220,

    /**
     * Aggressive re-approach, for when the player has put real distance
     * between themselves and the boss — typically by baiting a charge, dodging
     * into it and letting the committed lunge carry the worm away.
     *
     * Rather than plodding back at cruise speed, the head speeds up and steers
     * for a point *beside* the player instead of at them, so it comes back
     * around in an arc and re-engages with momentum instead of nosing straight
     * in. Suppressed entirely while charging: the charge is its own committed
     * movement and already scales its length with range.
     */
    farMovement: {
      enabled: true,
      /**
       * How far away the player has to be before the boss switches to far
       * movement.
       *
       * The camera follows the player at zoom 1, so the furthest point that
       * can ever be on screen is the viewport's half-diagonal — 734px at
       * 1280x720, ~890px on a typical laptop window. A threshold above that
       * means the entire behaviour plays out off-screen and the boss simply
       * reappears at the edge already back to normal, which looks like nothing
       * happened at all. Keep this comfortably under it.
       */
      minDistanceFromPlayer: 600,
      /**
       * Distance at which normal movement resumes.
       *
       * Deliberately lower than `minDistanceFromPlayer`: with one shared
       * threshold the head would flip modes every few frames while hovering at
       * the boundary, re-rolling its orbit direction each time and jittering
       * on the spot. The gap between the two is the hysteresis band.
       */
      resumeDistanceFromPlayer: 250,
      /** Radius of the ring around the player the head steers for. */
      targetDistanceFromPlayer: 220,
      /**
       * How far around that ring the aim point sits, in degrees, measured from
       * the player-to-head bearing.
       *
       * This is what makes the approach an arc rather than a beeline, and it
       * has to be an *angular* offset: a purely radial one puts the aim point
       * on the line through the head and the player, which is the exact same
       * bearing as aiming at the player and therefore changes nothing. 0 here
       * disables the arc and gives a straight fast charge-in.
       */
      orbitOffsetDeg: 55,
      /** Multiplies cruise speed while re-approaching. */
      speedMultiplier: 2.6,
      /**
       * Acceleration while re-approaching, in px/sec². Separate from
       * `accelerationPerSec` because the head's normal 420 would take ~2.5s to
       * reach the target speed below, by which point the re-approach is over
       * and the speed-up never actually happened. Deceleration on the way out
       * still uses the normal value, so it glides back down to cruise.
       */
      accelerationPerSec: 1100,
      /**
       * Multiplies `turnRateDeg` while re-approaching. Above 1 so the head can
       * actually carve the arc — at the base 115°/s it would swing too wide to
       * hold the ring.
       */
      turnRateMultiplier: 2,
    },
  },

  /**
   * ------------------------------------------------------------------------
   * CHAIN - how many parts there are and how they sit relative to each other.
   * ------------------------------------------------------------------------
   */
  chain: {
    /** Body segment count, rolled per worm. The tail (if enabled) is in addition to these. */
    bodySegments: { min: 9, max: 12 },
    /** Whether the last part uses the tail role (its own shape/stat curve). */
    includeTail: true,
    /**
     * How deeply each part buries itself into the part ahead of it, as a
     * fraction of its own forward reach (tip to center). 0 = tips just touch
     * the part ahead, 0.5 = half the part's nose is inside its leader.
     *
     * Spacing is then computed from the two parts' real outlines —
     * `leader.rearExtent + my.forwardExtent - overlap` — rather than from a
     * flat fraction of their radii. Radii don't know the difference between a
     * kite's protruding rear vertex and an arrow's cut-in one, so a single
     * radius ratio can't give both a sane head-to-body join and a sane
     * body-to-body one. Deriving from the outline means changing any shape in
     * this file keeps the whole chain correctly spaced with no re-tuning.
     */
    overlapRatio: (followerRole: ArrowHeadRole, _t: number): number =>
      followerRole === 'tail' ? 0.25 : 0.35,
    /**
     * Floor on the gap, as a fraction of the two parts' summed radii, so a
     * pathological shape config can never collapse the chain into one point.
     */
    minSpacingRatio: 0.2,
    /**
     * Depth the head draws at, with the rest of the chain stepping *down* from
     * it by `depthPerPart`.
     *
     * This has to leave enough headroom for the whole chain to stay above 0:
     * obstacles (and every other enemy) never set a depth at all, so they sit
     * on Phaser's default of 0, and anything that steps below it disappears
     * behind the terrain. Anchoring the ladder at 0 instead of above it is
     * exactly what put the segments behind obstacles while the head — tied at
     * 0 and winning on insertion order — kept drawing on top.
     *
     * 1 clears a chain of up to 100 parts and still leaves the worm far under
     * the player (100).
     */
    baseDepth: 1,
    /**
     * Depth step applied per part down the chain. Negative means each part
     * draws *under* the one ahead of it, which is what makes overlapping body
     * arrows read as plates layered front-to-back rather than an arbitrary
     * pile. Kept tiny so the worm stays in one thin depth band, just above the
     * band every other enemy shares.
     */
    depthPerPart: -0.01,
    /**
     * Extra rotation for a part's sprite, in degrees, on top of the default
     * "point your tip at your leader".
     *
     * 180 turns a part all the way around so it faces back the way the worm
     * came from — which is what the tail does, capping the worm with an arrow
     * pointing opposite the head instead of a second one pointing along with it.
     *
     * Spacing accounts for this: a reversed part leads with its rear and
     * trails with its tip, and those two reach different distances, so the
     * overlap would otherwise be wrong at that joint. Offsets past a quarter
     * turn in either direction count as reversed for that purpose.
     */
    facingOffsetDeg: (role: ArrowHeadRole): number => (role === 'tail' ? 180 : 0),
    /**
     * 1 = rigid worm: a part is placed exactly `spacing` behind its leader
     * every frame (this is what Terraria/tModLoader worms do). Below 1 the
     * part eases toward that spot instead, giving a looser, slinkier chain.
     */
    followLerp: 1,
    /**
     * Terraria's `NPC.realLife`: every part routes its damage into the head's
     * health pool, so the worm has ONE health bar and dies as one enemy.
     * Set false to make each segment separately killable with its own health
     * (`segment.soloHealthRatio` below).
     */
    sharedHealth: false,
    /** Only used when `sharedHealth` is false: each part's own health, as a fraction of the head's. */
    soloHealthRatio: 0.14,
    /**
     * Share one contact-damage cooldown across the whole worm.
     *
     * CollisionManager gates contact damage per enemy, and every part of the
     * worm is its own enemy - so without this, a worm sweeping through the
     * player lands one hit per part it drags across them, which for a long
     * chain is an instant kill rather than a hit. With it on, the worm hurts
     * the player at most once per CollisionManager cooldown, no matter how
     * many parts touch them.
     */
    sharedContactCooldown: true,
    /**
     * Shove other enemies aside on contact rather than merely displacing them,
     * so the worm ploughs through a crowded boss wave instead of nudging it.
     *
     * `strength` multiplies the shoving part's own velocity, so the barge is
     * naturally weak at cruise and violent mid-charge. Targets still get their
     * own `knockbackResistance` — Dodecahedron (1.0) is immune, Diamond (0.95)
     * barely moves — and so do the worm's own parts, which is what stops it
     * knocking itself apart where its segments overlap.
     */
    barge: {
      enabled: true,
      strength: 1,
    },
  },

  /**
   * ------------------------------------------------------------------------
   * SEGMENT - everything derived per-part from the head.
   * ------------------------------------------------------------------------
   * `t` runs 0 (first part behind the head) -> 1 (last part). Every function
   * here is called with `t`, so the curves hold at any chain length.
   */
  segment: {
    /**
     * How many discrete steps `t` is snapped to before it is used for
     * *appearance* (shape + radius). Stats stay continuous.
     *
     * Textures are cached by their full geometry, so a worm whose chain
     * length is rolled per spawn would otherwise produce a brand new set of
     * `t` values - and therefore a brand new set of textures to bake - every
     * single time one spawns. Snapping to a fixed ladder means every worm,
     * at any length, draws from the same handful of cached shapes.
     */
    textureSteps: 8,
    /** Part radius, as a fraction of the head's radius. Tapers toward the tail. */
    radiusRatio: (t: number) => lerp(0.78, 0.42, t),
    /** Contact damage, as a fraction of the head's damage. */
    damageRatio: (t: number) => lerp(0.72, 0.45, t),
    /** Armor, as a fraction of the head's defense. Segments are tankier than the head up front. */
    defenseRatio: (t: number) => lerp(1.2, 0.75, t),
    /** Collision radius as a fraction of the part's own radius. */
    hitboxSize: (t: number) => lerp(0.74, 0.68, t),
    /** Color at the far end of the chain; parts fade from the head's color to this. */
    tailColor: 0xffc04d,
    /**
     * Outline per role.
     *
     * Body segments are concave arrows (`backRatio` < 1) and are spaced to
     * overlap, so the chain reads as a run of nested "^" plates. The tail is
     * a kite like the head, which caps the worm off at both ends instead of
     * trailing away into a smaller and smaller arrow.
     */
    shapeFor: (role: ArrowHeadRole, t: number): ChevronShape =>
      role === 'tail'
        ? {
            // Kite, back-heavy: the rear vertex is the long point, so the worm
            // finishes in a spike pointing away from the head.
            halfSpread: 46,
            tipRadius: 0.85,
            barbRadius: 1.0,
            backRatio: 1.85,
          }
        : {
            // Concave arrow. Narrows slightly toward the tail so the run of
            // plates tapers instead of staying a uniform tube.
            halfSpread: lerp(62, 54, t),
            tipRadius: lerp(1.0, 1.08, t),
            barbRadius: lerp(1.0, 0.95, t),
            backRatio: lerp(0.42, 0.55, t),
          },
  },

  /**
   * ------------------------------------------------------------------------
   * COMBAT - head attacks. Both are individually switchable.
   * ------------------------------------------------------------------------
   */
  combat: {
    /**
     * Periodic lunge. Turn rate drops while charging, so the head commits to
     * a line, blows past the player and has to arc back around — the classic
     * worm read.
     */
    charge: {
      enabled: true,
      /** Delay between the end of one charge and the start of the next. */
      intervalMs: 5200,
      /**
       * Charge length at close range. Beyond `minDistance` this is stretched so
       * the lunge actually reaches the player — see `chargeDurationFor()`.
       */
      durationMs: 1500,
      speedMultiplier: 2.9,
      /** Multiplies `head.turnRateDeg` while charging. Below 1 = commits harder to its heading. */
      turnRateMultiplier: 0.15,
      /**
       * Range at or under which the charge runs for exactly `durationMs`.
       * Past it the charge is extended by however long the extra ground takes
       * at full charge speed, which keeps the *overshoot* constant instead of
       * the *distance* — a long-range lunge feels the same as a point-blank
       * one, it simply travels further before blowing past.
       */
      minDistance: 400,
      /**
       * Hard ceiling on a single charge.
       *
       * Without one, a corner-to-corner charge across a 2560x1440 world runs
       * ~6.8s, during which the head barely turns and (with
       * `volley.skipWhileCharging`) never shoots — the boss stops doing
       * anything else. At 4000ms the charge reaches ~1800px, so it still
       * covers most realistic engagements and only falls short when the player
       * is running the full diagonal.
       */
      maxDurationMs: 7000,
    },
    /** Spread of bullets fired from the head's tip. */
    volley: {
      enabled: true,
      intervalMs: 3400,
      count: 5,
      /** Total arc of the spread, in degrees, centered on the player. */
      spreadDeg: 46,
      /** Bullet damage as a fraction of the head's damage. */
      damageRatio: 0.4,
      /** Bullets are not fired while the head is mid-charge. */
      skipWhileCharging: true,
    },
  },

  /**
   * ------------------------------------------------------------------------
   * FX - purely cosmetic.
   * ------------------------------------------------------------------------
   */
  fx: {
    /**
     * Ambient particles trailing off each part. `every` is in AI frames;
     * 0 disables.
     *
     * Note this is *per part*, so the worm's particle budget scales with its
     * chain length — a full-length worm at `every: 14` sits around 140
     * particles/sec on a 120Hz display, against a pool of 2000. Raising the
     * burst size or lowering `every` multiplies by ~11, not by 1.
     */
    ambient: {
      every: 14,
      perBurst: { min: 1, max: 2 },
      radiusRange: { min: 2, max: 6 },
    },
    /**
     * When the head dies the chain dissolves back-to-front, this many ms
     * apart per part, instead of all parts popping at once.
     */
    deathStaggerMs: 70,
    /** Particles emitted by each part as it dissolves. */
    deathBurst: { min: 5, max: 9 },
  },

  /**
   * ------------------------------------------------------------------------
   * DROPS - bundle scatter on death, same shape as Dodecahedron's table.
   * ------------------------------------------------------------------------
   * Each row: `count` bundles of `rarity`, scattered `minRadius..maxRadius`
   * pixels from the head's death position.
   */
  drops: [
    { rarity: BundleRarity.Legendary, count: { min: 1, max: 2 }, minRadius: 10, maxRadius: 30 },
    { rarity: BundleRarity.Epic, count: { min: 2, max: 4 }, minRadius: 20, maxRadius: 50 },
    { rarity: BundleRarity.Rare, count: { min: 3, max: 4 }, minRadius: 30, maxRadius: 60 },
    { rarity: BundleRarity.Uncommon, count: { min: 4, max: 6 }, minRadius: 50, maxRadius: 80 },
    { rarity: BundleRarity.Common, count: { min: 4, max: 6 }, minRadius: 70, maxRadius: 100 },
  ],
}

/** A part's facing offset, in radians. See `chain.facingOffsetDeg`. */
export function facingOffset(role: ArrowHeadRole): number {
  return Phaser.Math.DegToRad(ArrowHeadConfig.chain.facingOffsetDeg(role))
}

/**
 * True when a part's facing offset turns it far enough around that its rear
 * leads and its tip trails, which swaps which extent points at its leader.
 */
export function isReversed(role: ArrowHeadRole): boolean {
  return Math.cos(facingOffset(role)) < 0
}

/**
 * How long a charge should run to reach a player `distanceToPlayer` away.
 *
 * A fixed-duration charge covers a fixed distance, so it reads as a real lunge
 * up close and as a pointless twitch from across the arena. This stretches the
 * duration with range instead.
 *
 * The extra time is bought at *full charge speed*, not at the average speed of
 * the charge, because the head spends its first ~0.75s accelerating from cruise
 * up to `speed * speedMultiplier` and that ramp is a fixed cost paid once, at
 * the start, whatever the range. Scaling the whole duration by `distance /
 * minDistance` would re-pay that ramp proportionally and badly overshoot at
 * long range; adding only `extra / chargeSpeed` holds the overshoot constant
 * (~200px at the tuned values) at every distance up to the cap.
 *
 * @param cruiseSpeed the head's own (difficulty-scaled) `speed`, so the timing
 *                    stays correct if the speed cap is ever lifted off 1.
 */
export function chargeDurationFor(distanceToPlayer: number, cruiseSpeed: number): number {
  const charge = ArrowHeadConfig.combat.charge
  const chargeSpeed = cruiseSpeed * charge.speedMultiplier
  if (chargeSpeed <= 0) return charge.durationMs

  const extra = Math.max(0, distanceToPlayer - charge.minDistance)
  return Math.min(charge.maxDurationMs, charge.durationMs + (extra / chargeSpeed) * 1000)
}

/**
 * Distance a part sits behind the part it follows.
 *
 * Shared by the head's initial chain placement and by the per-frame follow so
 * the two can never disagree. Radii passed in must already include scale.
 *
 * Which extent counts depends on which way each part is turned: a reversed
 * part reaches toward its leader with its *rear* and trails with its tip, and
 * on a kite those differ by more than 50%, so ignoring the flip would bury
 * that joint.
 */
export function spacingBetween(
  leader: { shape: ChevronShape; radius: number; role: ArrowHeadRole },
  follower: { shape: ChevronShape; radius: number; role: ArrowHeadRole; t: number }
): number {
  const cfg = ArrowHeadConfig.chain

  const followerReach =
    (isReversed(follower.role) ? rearExtent : forwardExtent)(follower.shape) * follower.radius
  const leaderReach =
    (isReversed(leader.role) ? forwardExtent : rearExtent)(leader.shape) * leader.radius
  const overlap = followerReach * cfg.overlapRatio(follower.role, follower.t)

  const floor = (follower.radius + leader.radius) * cfg.minSpacingRatio
  return Math.max(floor, leaderReach + followerReach - overlap)
}
