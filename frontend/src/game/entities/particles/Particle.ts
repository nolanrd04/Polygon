import Phaser from 'phaser'
import { TextureGenerator } from '../../utils/TextureGenerator'

/**
 * ============================================================================
 * Particle - pooled, purely-visual effect entity (Terraria "dust" equivalent)
 * ============================================================================
 *
 * Particles are customizable shape entities that can be spawned in to create
 * more visual effects for other entities. They are the direct analogue of
 * Terraria / tModLoader `Dust`:
 *
 *   - They are PURELY VISUAL. No physics body, no collision, no damage.
 *     Nothing in the game ever queries a particle - it just draws itself and
 *     dies. Never put gameplay logic in a particle.
 *   - They are POOLED. Spawning one does not allocate: instances and their
 *     sprites are recycled through a fixed-size slot array. This is what makes
 *     it safe to spawn dozens per frame from a projectile's AI().
 *   - A particle SUBCLASS is a "dust type". Behaviour lives in the class
 *     (`SetDefaults`/`OnSpawn`/`AI`/`OnKill`), and per-spawn variation is
 *     applied at the call site.
 *
 * Spawned particles have no behavior on their own. Out of the box a particle
 * drifts along its spawn velocity and disappears when `timeLeft` hits 0.
 * Override AI() to give it behaviour.
 *
 * To spawn one, use `NewParticlePerfect()` (returns the instance) or
 * `NewParticle()` (returns a pool handle, Terraria-style). To define a new
 * type, extend this class and override `SetDefaults()`. Always add randomness
 * at the call site or in `OnSpawn()` - uniform particles read as a bug rather
 * than an effect.
 *
 * IMPORTANT (pooling): instances are reused, so `SetDefaults()` runs on every
 * spawn and must set every field the type cares about. Anything it leaves
 * alone falls back to the base-class default (see `_resetFields`), never to a
 * value left over from the previous particle that used the slot.
 *
 * See `frontend/documentation/PARTICLE.md` for worked examples, the full field
 * reference, shape math, and the Terraria/tModLoader API mapping.
 */

/** Constructor signature of a concrete particle type, e.g. `SparkParticle`. */
export type ParticleType<T extends Particle = Particle> = new () => T

/**
 * Per-spawn overrides applied AFTER `SetDefaults()` and BEFORE `OnSpawn()`.
 * Everything here is also a plain public field, so it can equally be set on
 * the instance returned by `NewParticlePerfect()`.
 */
export interface ParticleOptions {
  timeLeft?: number
  color?: number
  scale?: number
  rotation?: number
  alpha?: number
  radius?: number
  sides?: number
  depth?: number
  additive?: boolean
}

export abstract class Particle {
  // ============================================================
  // POSITION & MOVEMENT
  // ============================================================

  /** Current world-space position in pixels */
  posX: number = 0
  posY: number = 0

  /** Current velocity in pixels per second */
  velocityX: number = 0
  velocityY: number = 0

  /** Constant acceleration in pixels per second squared.
   *  This is the top-down equivalent of Terraria's `noGravity` flag:
   *  0 (the default) means the particle keeps drifting, non-zero pulls it. */
  gravityX: number = 0
  gravityY: number = 0

  /** Velocity retained per second, 1 = no drag, 0.2 = keeps 20% of its speed
   *  each second (heavy drag), 0 = stops instantly. Frame-rate independent. */
  friction: number = 1

  /** Current rotation in radians, and how fast it spins (radians per second) */
  rotation: number = 0
  rotationVelocity: number = 0

  // ============================================================
  // LIFETIME
  // ============================================================

  /** Milliseconds remaining before the particle despawns */
  timeLeft: number = 1000

  /** Lifetime this particle spawned with. Read-only in practice - used to
   *  compute how far through its life the particle is (fades, easing). */
  maxTimeLeft: number = 1000

  /** False once the particle is dead. Setting this to false manually kills the
   *  particle at the start of the next frame (Terraria's `dust.active = false`). */
  active: boolean = false

  // ============================================================
  // APPEARANCE
  // ============================================================

  /** Hex tint, e.g. 0xff0000 */
  color: number = 0xffffff

  /** Base radius in pixels before `scale` is applied */
  radius: number = 4

  /** Radius multiplier for particle size, and how fast it grows/shrinks per
   *  second. The particle dies early if scale reaches 0. */
  scale: number = 1.0
  scaleVelocity: number = 0

  /** Base opacity (0-1). The drawn opacity is this multiplied by the
   *  fade-in/fade-out factor derived from `fadeInTime`/`fadeOutTime`. */
  alpha: number = 1.0

  /** Milliseconds spent ramping opacity 0 -> alpha at the start of life */
  fadeInTime: number = 0

  /** Milliseconds spent ramping opacity alpha -> 0 at the end of life */
  fadeOutTime: number = 0

  /** Shape: 1 = circle, 2 = ellipse, 3+ = polygon with that many sides */
  sides: number = 1

  /** Height/width ratio used when `sides === 2` (1 = circle, 0.5 = flat oval) */
  ellipseRatio: number = 0.5

  /**
   * Central angle (in degrees) swept by each side of the polygon, one entry
   * per side. Only read when `sides >= 3`; leave empty for a regular polygon.
   *
   * The shape is defined as a fan of triangles around the particle's center:
   * `angles[i]` is the angle between vertex i and vertex i+1, and
   * `vertexRadii[i]` is how far vertex i sits from the center (as a multiple
   * of `radius`). That keeps any combination mathematically consistent:
   *
   *   - The central angles of a closed fan must total 360 degrees, so this
   *     array is NORMALISED to that total. Only the proportions matter -
   *     [1, 1, 2] and [90, 90, 180] describe the same triangle.
   *   - Because every vertex is anchored to the center, the outline always
   *     closes no matter which radii are used, so irregular side lengths can
   *     never produce an invalid shape.
   *   - Side lengths are therefore derived rather than specified:
   *     L_i = sqrt(r_i^2 + r_i+1^2 - 2*r_i*r_i+1*cos(angles[i]))
   *
   * SIZING PITFALL: `radius` sets the envelope the vertices sit in, not the
   * size of the shape itself. Bunching vertices into a narrow arc leaves most
   * of that envelope empty, so the drawn shape ends up far smaller than
   * `radius` suggests - [30, 30, 300] at radius 5 renders under 2px wide and
   * is effectively invisible. Spread the angles out and raise `radius` until
   * the shape reads at the size you want.
   *
   * PERFORMANCE: each distinct angles/vertexRadii combination bakes its own
   * cached texture. Use a few fixed shapes and vary tint/scale/rotation for
   * variety - do not randomise these arrays per particle.
   */
  angles: number[] = []

  /** Per-vertex distance from the center, as a multiple of `radius`.
   *  Missing entries default to 1. See `angles` above. */
  vertexRadii: number[] = []

  /** Render with additive blending (glowing embers, sparks, energy) */
  additive: boolean = false

  /** Render depth. Player is 100, projectiles/enemies are 0, so the default
   *  draws particles over the action but under the player. */
  depth: number = 50

  // ============================================================
  // BEHAVIOUR FLAGS
  // ============================================================

  /**
   * When true (default) the base class integrates velocity, gravity, friction,
   * spin and scale every frame after `AI()` runs. Set to false in
   * `SetDefaults()` to drive `posX`/`posY` entirely from `AI()` - the
   * equivalent of returning false from tModLoader's `ModDust.Update`.
   */
  useBuiltInMotion: boolean = true

  // ============================================================
  // INTERNAL
  // ============================================================

  /** Slot index in the particle pool. This is the handle `NewParticle` returns. */
  id: number = -1

  /** The sprite this particle draws into. Recycled along with the instance. */
  protected sprite!: Phaser.GameObjects.Sprite

  /** The scene this particle belongs to. */
  protected scene!: Phaser.Scene

  /** Cached to avoid redundant per-frame Phaser calls */
  private _previousColor: number = -1
  private _previousTextureKey: string = ''

  // ============================================================
  // LIFECYCLE HOOKS - Override these in your particle class
  // ============================================================

  /**
   * Set the particle's appearance and motion defaults. Called on EVERY spawn
   * (instances are pooled), before the per-spawn options are applied.
   */
  abstract SetDefaults(): void

  /**
   * Called once, right after the particle has been fully spawned - position,
   * velocity and all per-spawn overrides are already applied. The natural
   * place for per-spawn randomness.
   */
  OnSpawn(): void {}

  /**
   * Called every frame, before the built-in motion integration.
   * Modify velocity/scale/color here for custom behaviour.
   */
  AI(): void {}

  /**
   * Called when the particle dies (lifetime expired, faded out, or killed).
   * Use to chain further effects. Keep it cheap - this can fire hundreds of
   * times a second.
   */
  OnKill(): void {}

  /**
   * Return false to skip Draw() this frame (e.g. flickering effects).
   */
  PreDraw(): boolean {
    return true
  }

  /**
   * Pushes this particle's state onto its sprite. Override for custom
   * rendering. There is deliberately no Graphics path and no PostDraw hook:
   * particles are leaf visuals spawned in bulk, and per-particle Graphics
   * would erase the performance advantage of the pool.
   */
  Draw(): void {
    const sprite = this.sprite

    sprite.setPosition(this.posX, this.posY)
    sprite.setRotation(this.rotation)
    sprite.setAlpha(this.alpha * this._fadeFactor())

    if (this.color !== this._previousColor) {
      sprite.setTint(this.color)
      this._previousColor = this.color
    }

    // One texture is baked per shape at BASE_TEXTURE_RADIUS; every radius and
    // scale combination is reached by scaling that sprite, so radius/scale can
    // change freely without ever generating another texture.
    const displaySize = (this.radius * this.scale) / Particle.BASE_TEXTURE_RADIUS * TextureGenerator.getDisplayScale()
    if (this.sides === 2) {
      sprite.setScale(displaySize, displaySize * this.ellipseRatio)
    } else {
      sprite.setScale(displaySize)
    }
  }

  // ============================================================
  // INSTANCE METHODS
  // ============================================================

  /** Kills this particle. It is released back to the pool next frame. */
  Kill(): void {
    this.active = false
  }

  /**
   * Sizes the particle as an ellipse using pixel dimensions instead of the
   * radius/ratio pair `Draw()` works in.
   *
   * `radius` scales BOTH axes and `ellipseRatio` is thickness relative to
   * length, so lengthening a streak by hand means raising one and dividing
   * the other by the same factor. This does that conversion.
   *
   * Sets `sides = 2` and resets `scale` to 1, since `scale` multiplies both
   * axes and would otherwise undo the dimensions given here. Apply it AFTER
   * SetDefaults()/spawn options, and change `scale` afterwards only if you
   * want to grow or shrink the whole streak proportionally.
   *
   * @param length Long axis in pixels (points along `rotation`)
   * @param thickness Short axis in pixels
   */
  SetStreak(length: number, thickness: number): void {
    this.sides = 2
    this.scale = 1
    this.radius = length
    this.ellipseRatio = length > 0 ? thickness / length : 1
  }

  /** How far through its life this particle is, 0 (just spawned) to 1 (dead). */
  get lifeProgress(): number {
    if (this.maxTimeLeft <= 0) return 1
    return Phaser.Math.Clamp(1 - this.timeLeft / this.maxTimeLeft, 0, 1)
  }

  /** Opacity multiplier from the fade-in/fade-out ramps */
  private _fadeFactor(): number {
    let factor = 1

    if (this.fadeInTime > 0) {
      const age = this.maxTimeLeft - this.timeLeft
      if (age < this.fadeInTime) factor = age / this.fadeInTime
    }

    if (this.fadeOutTime > 0 && this.timeLeft < this.fadeOutTime) {
      factor = Math.min(factor, this.timeLeft / this.fadeOutTime)
    }

    return Phaser.Math.Clamp(factor, 0, 1)
  }

  /** @internal Restores every field to its base-class default. Runs before
   *  SetDefaults() on each spawn so no state leaks between pooled uses.
   *  Keep this in sync when adding fields to the class. */
  private _resetFields(): void {
    this.posX = 0
    this.posY = 0
    this.velocityX = 0
    this.velocityY = 0
    this.gravityX = 0
    this.gravityY = 0
    this.friction = 1
    this.rotation = 0
    this.rotationVelocity = 0
    this.timeLeft = 1000
    this.maxTimeLeft = 1000
    this.color = 0xffffff
    this.radius = 4
    this.scale = 1.0
    this.scaleVelocity = 0
    this.alpha = 1.0
    this.fadeInTime = 0
    this.fadeOutTime = 0
    this.sides = 1
    this.ellipseRatio = 0.5
    this.additive = false
    this.depth = 50
    this.useBuiltInMotion = true
    // Emptied in place rather than reassigned so the common (regular-shape)
    // path stays allocation-free
    this.angles.length = 0
    this.vertexRadii.length = 0
  }

  /** @internal Brings a pooled instance to life at a position */
  private _activate(
    scene: Phaser.Scene,
    slot: number,
    posX: number,
    posY: number,
    velocityX: number,
    velocityY: number,
    options?: ParticleOptions
  ): void {
    this.scene = scene
    this.id = slot
    this.active = true

    this._resetFields()
    this.SetDefaults()

    this.posX = posX
    this.posY = posY
    this.velocityX = velocityX
    this.velocityY = velocityY

    // Per-spawn overrides win over SetDefaults()
    if (options) {
      if (options.timeLeft !== undefined) this.timeLeft = options.timeLeft
      if (options.color !== undefined) this.color = options.color
      if (options.scale !== undefined) this.scale = options.scale
      if (options.rotation !== undefined) this.rotation = options.rotation
      if (options.alpha !== undefined) this.alpha = options.alpha
      if (options.radius !== undefined) this.radius = options.radius
      if (options.sides !== undefined) this.sides = options.sides
      if (options.depth !== undefined) this.depth = options.depth
      if (options.additive !== undefined) this.additive = options.additive
    }

    this.maxTimeLeft = this.timeLeft

    // Create the sprite on first use; afterwards it is recycled with the instance
    const textureKey = this._resolveTextureKey()
    if (!this.sprite) {
      this.sprite = scene.add.sprite(posX, posY, textureKey)
      this._previousTextureKey = textureKey
    } else if (textureKey !== this._previousTextureKey) {
      this.sprite.setTexture(textureKey)
      this._previousTextureKey = textureKey
    }

    this.sprite.setVisible(true)
    this.sprite.setDepth(this.depth)
    this.sprite.setBlendMode(this.additive ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL)
    this._previousColor = -1

    this.OnSpawn()

    // Draw immediately so the particle is visible on its spawn frame
    if (this.PreDraw()) this.Draw()
  }

  /** @internal Picks the cached texture for this particle's shape */
  private _resolveTextureKey(): string {
    const base = Particle.BASE_TEXTURE_RADIUS

    // 1 = circle, 2 = ellipse (a circle squashed at draw time via ellipseRatio)
    if (this.sides < 3) {
      return TextureGenerator.getOrCreateCircle(this.scene, { radius: base })
    }

    // Irregular polygon: custom central angles and/or custom vertex distances
    if (this.angles.length >= 3 || this.vertexRadii.length > 0) {
      const angles = this.angles.length >= 3
        ? this.angles
        : Array(this.sides).fill(360 / this.sides)

      return TextureGenerator.getOrCreateIrregularPolygon(this.scene, {
        angles,
        radius: base,
        vertexRadii: this.vertexRadii.length > 0 ? this.vertexRadii : undefined
      })
    }

    // Regular polygon
    return TextureGenerator.getOrCreatePolygon(this.scene, {
      sides: Math.round(this.sides),
      radius: base
    })
  }

  /** @internal Advances one frame. `delta` is in milliseconds. */
  private _update(delta: number): void {
    this.timeLeft -= delta
    if (this.timeLeft <= 0) {
      this.Kill()
      return
    }

    this.AI()
    if (!this.active) return

    if (this.useBuiltInMotion) {
      const dt = delta / 1000

      this.velocityX += this.gravityX * dt
      this.velocityY += this.gravityY * dt

      if (this.friction !== 1) {
        // Exponential decay keeps drag identical at any frame rate
        const retained = Math.pow(Math.max(0, this.friction), dt)
        this.velocityX *= retained
        this.velocityY *= retained
      }

      this.posX += this.velocityX * dt
      this.posY += this.velocityY * dt
      this.rotation += this.rotationVelocity * dt
      this.scale += this.scaleVelocity * dt
    }

    // A shrinking particle dies when it has nothing left to draw
    if (this.scale <= 0 || this.alpha <= 0) {
      this.Kill()
      return
    }

    if (this.PreDraw()) this.Draw()
  }

  /** @internal Hides the sprite and hands the instance back to the free list */
  private _deactivate(): void {
    this.active = false
    this.id = -1
    this.sprite?.setVisible(false)
  }

  // ============================================================================
  // STATIC POOL & SPAWN API
  // ============================================================================

  /** Radius every particle texture is baked at. Particles reach their actual
   *  on-screen size by scaling the sprite, so this never needs changing. */
  static readonly BASE_TEXTURE_RADIUS = 16

  /** Hard cap on simultaneously-live particles. Spawns past this are dropped
   *  (Terraria does the same once `Main.dust` is full) - particles are
   *  cosmetic, so silently skipping is always better than dropping frames. */
  static MAX_PARTICLES = 2000

  /** Scene particles are spawned into. Null until Initialize() is called. */
  private static scene: Phaser.Scene | null = null

  /** Live particles by slot index; holes are free slots. */
  private static slots: (Particle | null)[] = []

  /** Stack of free slot indices */
  private static freeSlots: number[] = []

  /** Dead instances (and their sprites) available for reuse, keyed by type */
  private static recycled: Map<ParticleType<any>, Particle[]> = new Map()

  /** Number of live particles */
  private static liveCount: number = 0

  /** Warn about an uninitialized system once, not once per particle */
  private static warnedUninitialized: boolean = false

  /**
   * Wires the particle system to a scene. Call once from `MainScene.create()`,
   * after TextureGenerator.generateCommonTextures(). Safe to call again on
   * scene restart - all previous particles and their sprites are discarded.
   */
  static Initialize(scene: Phaser.Scene): void {
    // Sprites belong to the old scene and are already gone; drop every
    // reference so nothing recycled points at a destroyed GameObject.
    this.slots = new Array(this.MAX_PARTICLES).fill(null)
    this.freeSlots = []
    for (let i = this.MAX_PARTICLES - 1; i >= 0; i--) this.freeSlots.push(i)
    this.recycled.clear()
    this.liveCount = 0
    this.warnedUninitialized = false

    this.scene = scene
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.scene === scene) this.scene = null
    })
  }

  /**
   * Spawns a particle and returns its pool slot, or -1 if the pool is full.
   * This mirrors Terraria's `Dust.NewDust`, where the returned index is used
   * to look the dust back up (here, via `Particle.Get()`).
   *
   * Prefer `NewParticlePerfect()` unless you specifically want the handle -
   * it hands back the instance directly and skips the lookup.
   */
  static NewParticle<T extends Particle>(
    type: ParticleType<T>,
    posX: number,
    posY: number,
    velocityX: number = 0,
    velocityY: number = 0,
    options?: ParticleOptions
  ): number {
    const particle = this.NewParticlePerfect(type, posX, posY, velocityX, velocityY, options)
    return particle ? particle.id : -1
  }

  /**
   * Spawns a particle and returns the instance itself, or null if the pool is
   * full or the system has not been initialized. Equivalent to Terraria's
   * `Dust.NewDustPerfect`.
   *
   * ALWAYS null-check the result - the pool is finite by design.
   */
  static NewParticlePerfect<T extends Particle>(
    type: ParticleType<T>,
    posX: number,
    posY: number,
    velocityX: number = 0,
    velocityY: number = 0,
    options?: ParticleOptions
  ): T | null {
    const scene = this.scene
    if (!scene) {
      if (!this.warnedUninitialized) {
        console.warn('[Particle] Particle.Initialize(scene) was never called - particles are disabled')
        this.warnedUninitialized = true
      }
      return null
    }

    const slot = this.freeSlots.pop()
    if (slot === undefined) return null // Pool exhausted - drop the particle

    // Reuse a dead instance of this type (keeping its sprite) when possible
    const pooled = this.recycled.get(type)
    const particle = (pooled && pooled.length > 0 ? pooled.pop()! : new type()) as T

    this.slots[slot] = particle
    this.liveCount++

    // _activate is private to Particle, which this static method lives inside of
    particle._activate(scene, slot, posX, posY, velocityX, velocityY, options)

    return particle
  }

  /**
   * Spawns `count` particles fanned around a point - the usual shape of an
   * impact or death effect.
   *
   * By default each particle gets its own evenly-spaced slot in the arc, then
   * wobbles within it (`jitter`). That is "stratified" rather than truly
   * random: independent random angles clump together and leave visible gaps,
   * which reads as a mistake rather than as randomness. Set `randomAngle` for
   * fully independent angles when that clumping is what you actually want.
   *
   * @param spread Arc to spawn across in radians (default: full circle)
   * @param direction Center of that arc in radians (default: 0)
   * @param speedVariance Fractional random spread on speed, 0.4 = +/-40%
   * @param jitter How far a particle may wander inside its own slot, 0 = perfectly
   *               even spacing, 1 = anywhere in its slot (default: 2/3)
   * @param randomAngle Ignore slots entirely and pick each angle uniformly across
   *                    `spread`. Produces real clumps and gaps (default: false)
   */
  static Burst<T extends Particle>(
    type: ParticleType<T>,
    posX: number,
    posY: number,
    count: number,
    options?: ParticleOptions & {
      speed?: number
      speedVariance?: number
      spread?: number
      direction?: number
      jitter?: number
      randomAngle?: boolean
    }
  ): void {
    const speed = options?.speed ?? 150
    const speedVariance = options?.speedVariance ?? 0.3
    const spread = options?.spread ?? Math.PI * 2
    const direction = options?.direction ?? 0
    const jitter = options?.jitter ?? 2 / 3
    const randomAngle = options?.randomAngle ?? false

    const start = direction - spread / 2
    const step = count > 1 ? spread / count : 0

    for (let i = 0; i < count; i++) {
      const angle = randomAngle
        ? start + Phaser.Math.FloatBetween(0, spread)
        : start + step * i + Phaser.Math.FloatBetween(-step * jitter / 2, step * jitter / 2)
      const magnitude = speed * Phaser.Math.FloatBetween(1 - speedVariance, 1 + speedVariance)

      this.NewParticlePerfect(
        type,
        posX,
        posY,
        Math.cos(angle) * magnitude,
        Math.sin(angle) * magnitude,
        options
      )
    }
  }

  /** Looks up a live particle by the slot handle `NewParticle` returned. */
  static Get(id: number): Particle | null {
    if (id < 0 || id >= this.slots.length) return null
    return this.slots[id]
  }

  /**
   * Advances every live particle. Call once per frame from `MainScene.update`.
   * @param delta Milliseconds since the previous frame
   */
  static UpdateAll(delta: number): void {
    const slots = this.slots

    for (let i = 0; i < slots.length; i++) {
      const particle = slots[i]
      if (!particle) continue

      if (particle.active) {
        particle._update(delta)
      }

      // Reaped here rather than inside Kill() so the slot array is never
      // mutated part-way through this loop
      if (!particle.active) {
        this._release(i, particle)
      }
    }
  }

  /** Kills every live particle immediately (wave end, scene teardown). */
  static Clear(): void {
    for (let i = 0; i < this.slots.length; i++) {
      const particle = this.slots[i]
      if (particle) this._release(i, particle)
    }
  }

  /** Number of particles currently alive */
  static get Count(): number {
    return this.liveCount
  }

  /** @internal Runs OnKill and returns the slot and instance to the pool */
  private static _release(slot: number, particle: Particle): void {
    particle.OnKill()
    particle._deactivate()

    this.slots[slot] = null
    this.freeSlots.push(slot)
    this.liveCount--

    const type = particle.constructor as ParticleType<any>
    const pooled = this.recycled.get(type)
    if (pooled) {
      pooled.push(particle)
    } else {
      this.recycled.set(type, [particle])
    }
  }
}