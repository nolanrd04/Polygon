import Phaser from 'phaser'
import { WORLD_WIDTH, WORLD_HEIGHT } from '../core/GameConfig'

/**
 * ============================================================================
 * LightingSystem - Terraria-style tile light map
 * ============================================================================
 *
 * USAGE (static, same shape as the Particle pool):
 * ```typescript
 * // Once, in MainScene.create() - AFTER the map exists:
 * LightingSystem.Initialize(this)
 * LightingSystem.SetOccluders(this.mapManager.getObstacleData())
 *
 * // Any entity, any frame, from any hook:
 * LightingSystem.AddLight(this.x, this.y, 0x00ff88, 1.3)
 * LightingSystem.AddLight(this.x, this.y, 0xff3333, 0.6, LightingSystem.SHAPE_DIAMOND)
 *
 * // Once, at the END of MainScene.update():
 * LightingSystem.UpdateAll()
 * ```
 *
 * Lights are IMMEDIATE-MODE: a light exists for exactly the frame it was added.
 * Nothing to register, nothing to clean up - a bullet stops lighting the room by
 * virtue of no longer calling AddLight.
 *
 * ----------------------------------------------------------------------------
 * HOW IT WORKS (and why it is not Phaser's Light2D)
 *
 * Light2D is a per-object shader: it lights only objects you opt in with
 * setPipeline('Light2D'), it has no occlusion at all, and it caps at 10 lights.
 *
 * Terraria instead stores light on a TILE GRID and floods it outward:
 *
 *   1. Lights inject brightness into the tile they occupy.
 *   2. That value spreads tile-to-tile, multiplied by a decay factor at each
 *      step. There is no distance-squared falloff anywhere - the falloff is
 *      emergent from repeated decay across the grid.
 *   3. Decay is steeper through solid tiles, so obstacles darken and occlude.
 *   4. The low-res buffer (one texel per tile) is bilinearly upscaled and
 *      MULTIPLIED over the scene. That upscale is what turns a coarse grid into
 *      smooth gradients.
 *
 * ----------------------------------------------------------------------------
 * WHAT GETS LIT, AND WHY THE FLOOR FILL STAYS BLACK
 *
 * Multiply compositing can only ever darken: `albedo * light` on a near-black
 * surface stays near-black under any light. So MapManager's colours are ALBEDO -
 * what a surface shows when fully lit - and `ambient` scales them back down.
 *
 * But that logic does NOT extend to the floor FILL, because the fill covers the
 * whole screen. Brightening it does not read as lighting, it reads as uniform
 * haze over every pixel of the frame. So the fill stays near-black and the GRID
 * and OBSTACLES carry the albedo - those are what light reveals.
 *
 * Entities are excluded entirely by depth (see OVERLAY_DEPTH): a coloured light
 * multiplied over a differently-coloured sprite destroys it, and entity colour
 * here is gameplay signal.
 *
 * ----------------------------------------------------------------------------
 * A LIMIT WORTH KNOWING: SHADOW CONTRAST
 *
 * Flood-fill lighting is shortest-path lighting, so light bends around corners.
 * That is a feature for large contiguous walls - it is why Terraria's caves look
 * the way they do - but a SMALL CONVEX obstacle casts almost no shadow, because
 * routing around it barely lengthens the path.
 *
 * Measured against MapManager's real obstacles (radius 20-40px, ~5 tiles across)
 * the area directly behind one is only ~3-8% darker than open floor at the same
 * distance, at any decay settings. Lowering solidDecay does not help; it darkens
 * the obstacle's own silhouette, not the area beyond it. This is inherent to the
 * model - Terraria has the same property, and a single block casts no real
 * shadow there either. Sharp shadows from small obstacles need a different
 * technique (analytic shadow cones or raycasting) layered on top.
 */

/** A light added this frame. Cleared by every UpdateAll(). */
interface Emitter {
  x: number
  y: number
  r: number
  g: number
  b: number
  shape: number
  /**
   * Per-tile air decay for this light, derived from its requested radius.
   * Lights sharing a (shape, decay) pair are flooded together - see UpdateAll().
   */
  decay: number
}

export interface LightingOptions {
  /** World pixels per light tile. Terraria uses 16. Smaller = sharper, costlier. */
  tileSize?: number
  /**
   * Per-tile survival fraction through open space. A light fades from `intensity`
   * to `ambient` after `log(ambient / intensity) / log(airDecay)` tiles, so at the
   * default 0.93 an intensity-1.3 light pools out to ~17 tiles (~270px).
   */
  airDecay?: number
  /**
   * Per-tile survival fraction through an obstacle. Mostly sets how dark an
   * obstacle's own silhouette goes - see the shadow-contrast note above for why
   * it does little to the area behind one.
   */
  solidDecay?: number
  /**
   * Light level everywhere, before any light source. This is the global/ambient
   * light: it is what lets you see parts of the world nothing is lighting.
   * 0 is pitch black, 1 is fully lit.
   */
  ambient?: number
  /**
   * Highlight rolloff. Light is tone-mapped as `1 - exp(-light * exposure)`
   * instead of being hard-clamped, so a bright light centre rolls off smoothly
   * toward white rather than flattening into a blown-out disc. Raise for a
   * brighter image, lower for a moodier one.
   */
  exposure?: number
  /**
   * Forward+backward sweep pairs per shape group. One pair propagates light that
   * only ever travels down-right or up-left; a second lets it wrap corners
   * properly. Above 2 the difference is not visible.
   */
  iterations?: number
}

export class LightingSystem {
  // ============================================================
  // LIGHT SHAPES
  // ============================================================
  //
  // A light's shape is set by what a DIAGONAL step costs relative to an
  // orthogonal one. That single number picks the distance metric the flood
  // measures in, and the metric is the shape:
  //
  //   cost 1     - a diagonal is as cheap as a straight step  -> Chebyshev -> SQUARE
  //   cost 1.414 - a diagonal costs sqrt(2), as in real space -> Euclidean -> ROUND
  //   cost 2     - a diagonal is worth two straight steps, so
  //                cutting the corner gains nothing           -> Manhattan -> DIAMOND
  //
  // Any value in between is valid and blends the shapes continuously - 1.7 is a
  // rounded diamond, 1.2 a rounded square.

  /** Boxy light, square falloff. */
  static readonly SHAPE_SQUARE = 1
  /** Natural circular light. The default. */
  static readonly SHAPE_ROUND = Math.SQRT2
  /** Four-pointed star / rhombus, light reaching furthest along the axes. */
  static readonly SHAPE_DIAMOND = 2

  /**
   * Depth of the light overlay - i.e. WHAT the light map is allowed to darken.
   *
   * At -5 it sits above the background grid (-10) and the obstacles (-9) but
   * BELOW every entity, so light shapes the environment while the player,
   * enemies, projectiles and particles keep their exact authored colours. That
   * matters here because entity colour is gameplay signal, and because a
   * coloured light multiplied over a differently-coloured sprite wrecks it - a
   * green player light over a red enemy multiplies out to near-black.
   *
   * Raise this above the player (e.g. 200) to get the Terraria behaviour instead,
   * where entities themselves go dark in unlit areas. Keep it under 400 either
   * way, so the touch controls and UI stay readable.
   */
  static readonly OVERLAY_DEPTH = -5

  private static readonly TEXTURE_KEY = 'lightmap'

  private static scene: Phaser.Scene | null = null
  private static warnedUninitialized = false

  private static tileSize = 16
  private static airDecay = 0.93
  private static solidDecay = 0.15
  private static ambient = 0.38
  private static iterations = 2
  private static exposure = 1

  private static cols = 0
  private static rows = 0

  /** Final light level per tile, 3 floats (RGB) per tile. */
  private static light: Float32Array
  /** Scratch buffer for one shape group's flood, before it is merged into `light`. */
  private static scratch: Float32Array
  /**
   * Per-tile decay factor for the group currently being flooded. Rebuilt from
   * `solid` on every propagate() call, since a light's radius sets its own air
   * decay and so each group has a different map.
   */
  private static decay: Float32Array
  /**
   * Per-tile occluder flag - the durable geometry, baked once by SetOccluders.
   *
   * Kept as its own mask rather than inferred from `decay`, because `decay` is a
   * Float32Array: it stores 0.93 as 0.9300000071525574, so comparing an entry
   * back against the float64 `airDecay` is never equal and every test silently
   * reports "solid".
   */
  private static solid: Uint8Array
  /** `decay ^ shape` for the group currently being flooded. See propagate(). */
  private static diagDecay: Float32Array
  /**
   * Light the world emits by itself, baked once - glowing grid lines, obstacles
   * that give off their own colour. Merged in every frame without being flooded,
   * so it stays put instead of bleeding outward. See BakeLight().
   */
  private static emission: Float32Array
  private static hasEmission = false
  /** Flood groups run on the last frame. Exposed via GroupCount for tuning. */
  private static lastGroupCount = 0

  private static emitters: Emitter[] = []

  private static texture: Phaser.Textures.CanvasTexture | null = null
  private static imageData: ImageData | null = null
  private static pixels: Uint8ClampedArray | null = null
  private static overlay: Phaser.GameObjects.Image | null = null

  // ============================================================
  // SETUP
  // ============================================================

  /**
   * Bind the light map to a scene and build the overlay.
   * Call once in create(). Safe to call again on scene restart.
   */
  static Initialize(scene: Phaser.Scene, options: LightingOptions = {}): void {
    this.Clear()

    this.scene = scene
    this.warnedUninitialized = false
    this.tileSize = options.tileSize ?? 16
    this.airDecay = options.airDecay ?? 0.93
    this.solidDecay = options.solidDecay ?? 0.15
    this.ambient = options.ambient ?? 0.38
    this.iterations = options.iterations ?? 2
    this.exposure = options.exposure ?? 1

    this.cols = Math.ceil(WORLD_WIDTH / this.tileSize)
    this.rows = Math.ceil(WORLD_HEIGHT / this.tileSize)

    const tiles = this.cols * this.rows
    this.light = new Float32Array(tiles * 3)
    this.scratch = new Float32Array(tiles * 3)
    this.decay = new Float32Array(tiles).fill(this.airDecay)
    this.solid = new Uint8Array(tiles)
    this.diagDecay = new Float32Array(tiles)
    this.emission = new Float32Array(tiles * 3)
    this.hasEmission = false

    // One texel per tile. The bilinear upscale to world size is what makes the
    // coarse grid read as smooth gradients rather than visible squares.
    if (scene.textures.exists(LightingSystem.TEXTURE_KEY)) {
      scene.textures.remove(LightingSystem.TEXTURE_KEY)
    }
    this.texture = scene.textures.createCanvas(LightingSystem.TEXTURE_KEY, this.cols, this.rows)!
    this.texture.setFilter(Phaser.Textures.FilterMode.LINEAR)
    this.imageData = this.texture.context.createImageData(this.cols, this.rows)
    this.pixels = this.imageData.data

    // Alpha stays 255 for every texel. Phaser's MULTIPLY blend is
    // [DST_COLOR, ONE_MINUS_SRC_ALPHA], which reduces to a clean src * dst only
    // at alpha 1; any lower and the unlit scene bleeds back through.
    for (let i = 3; i < this.pixels.length; i += 4) {
      this.pixels[i] = 255
    }

    this.overlay = scene.add.image(0, 0, LightingSystem.TEXTURE_KEY)
    this.overlay.setOrigin(0, 0)
    this.overlay.setDisplaySize(WORLD_WIDTH, WORLD_HEIGHT)
    this.overlay.setBlendMode(Phaser.BlendModes.MULTIPLY)
    this.overlay.setDepth(LightingSystem.OVERLAY_DEPTH)
  }

  /**
   * Bake obstacles into the occluder mask. Call once after the map is generated;
   * obstacles never move, so this never needs repeating.
   *
   * Only the mask is stored, not decay values: a light's radius sets its own air
   * decay, so the actual per-tile decay map is derived from this mask once per
   * flood group in propagate().
   *
   * Obstacles are treated as circles, matching the circular physics bodies
   * MapManager gives them, so what blocks light is what blocks movement. An
   * obstacle smaller than a tile may not cover any tile centre and so will not
   * occlude at all - lower `tileSize` if that matters.
   */
  static SetOccluders(obstacles: { x: number; y: number; radius: number }[]): void {
    if (!this.scene) return this.warnUninitialized()

    this.solid.fill(0)

    for (const o of obstacles) {
      const minTx = Math.max(0, Math.floor((o.x - o.radius) / this.tileSize))
      const maxTx = Math.min(this.cols - 1, Math.floor((o.x + o.radius) / this.tileSize))
      const minTy = Math.max(0, Math.floor((o.y - o.radius) / this.tileSize))
      const maxTy = Math.min(this.rows - 1, Math.floor((o.y + o.radius) / this.tileSize))
      const r2 = o.radius * o.radius

      for (let ty = minTy; ty <= maxTy; ty++) {
        const cy = ty * this.tileSize + this.tileSize / 2
        for (let tx = minTx; tx <= maxTx; tx++) {
          const cx = tx * this.tileSize + this.tileSize / 2
          const dx = cx - o.x
          const dy = cy - o.y
          if (dx * dx + dy * dy <= r2) {
            this.solid[ty * this.cols + tx] = 1
          }
        }
      }
    }
  }

  /** World pixels per light tile, for callers baking emission along a pattern. */
  static get TileSize(): number {
    return this.tileSize
  }

  /**
   * Flood groups run on the last UpdateAll() - the system's main cost driver, at
   * roughly 0.9ms each. One group is the baseline; it climbs when lights use
   * differing (shape, radius, intensity) combinations. Surface this on a debug
   * readout while tuning light values, so a group split does not go unnoticed.
   */
  static get GroupCount(): number {
    return this.lastGroupCount
  }

  /**
   * Bake self-illumination into the world: light a surface gives off by itself,
   * rather than light falling on it. Grid lines and obstacles use this, which is
   * what stops unlit areas from being a featureless black void - the darkness
   * keeps its structure.
   *
   * Baked light is NOT flooded. Flooding it would defeat the purpose: emitters
   * only a few tiles apart (like a 50px grid) would bleed into each other and
   * flatten back into a uniform haze. Held in place it stays a lattice, and the
   * light map's bilinear upscale already gives each tile a soft 16px falloff.
   *
   * Call after the map is generated; survives until ClearBaked() or Initialize().
   *
   * @param radius World-pixel radius to fill. 0 lights only the tile at (x, y).
   * @param skipSolid Leave tiles occupied by an occluder alone. Set this for
   *        anything that is a FLOOR decal - a grid, a stain, a glowing rune -
   *        because the floor does not exist where an obstacle covers it, and
   *        emission baked under one shows through as banding across it (the
   *        obstacle renders below the light overlay, so it gets multiplied by
   *        whatever light lands on its tiles). Requires SetOccluders() first.
   */
  static BakeLight(
    x: number,
    y: number,
    color: number,
    intensity: number,
    radius: number = 0,
    skipSolid: boolean = false
  ): void {
    if (!this.scene) return this.warnUninitialized()

    const r = ((color >> 16) & 0xff) / 255 * intensity
    const g = ((color >> 8) & 0xff) / 255 * intensity
    const b = (color & 0xff) / 255 * intensity

    const minTx = Math.max(0, Math.floor((x - radius) / this.tileSize))
    const maxTx = Math.min(this.cols - 1, Math.floor((x + radius) / this.tileSize))
    const minTy = Math.max(0, Math.floor((y - radius) / this.tileSize))
    const maxTy = Math.min(this.rows - 1, Math.floor((y + radius) / this.tileSize))
    const r2 = radius * radius

    for (let ty = minTy; ty <= maxTy; ty++) {
      for (let tx = minTx; tx <= maxTx; tx++) {
        const t = ty * this.cols + tx
        if (radius > 0) {
          const dx = tx * this.tileSize + this.tileSize / 2 - x
          const dy = ty * this.tileSize + this.tileSize / 2 - y
          if (dx * dx + dy * dy > r2) continue
        }
        if (skipSolid && this.solid[t]) continue
        const i = t * 3
        if (r > this.emission[i]) this.emission[i] = r
        if (g > this.emission[i + 1]) this.emission[i + 1] = g
        if (b > this.emission[i + 2]) this.emission[i + 2] = b
      }
    }

    this.hasEmission = true
  }

  /** Drop all baked self-illumination. */
  static ClearBaked(): void {
    this.emission?.fill(0)
    this.hasEmission = false
  }

  // ============================================================
  // EMITTING
  // ============================================================

  /**
   * Add a light for this frame. Immediate-mode, so call it every frame the light
   * should exist and simply stop calling it when it should not.
   *
   * @param color Light colour as 0xRRGGBB.
   * @param intensity Brightness at the source. ~0.6 is a faint enemy glow, ~1.3
   *                  a player torch. Values above 1 are fine; the centre rolls
   *                  off toward white rather than clamping (see `exposure`).
   * @param radius Approximate world-pixel reach. Omit (or pass 0) to inherit the
   *               global `airDecay`, which is the original behaviour.
   *
   *               Intensity alone is a poor radius control: reach goes as
   *               `log(ambient / intensity) / log(airDecay)`, so it is LOGARITHMIC
   *               in intensity - each doubling adds a fixed ~150px, and doubling
   *               the radius of an intensity-1 light would take intensity 10, long
   *               past the point the centre blows out to white. This parameter
   *               solves for the decay rate instead, so brightness and size are
   *               independent knobs.
   *
   *               NOTE: like `shape`, radius is really a property of the SWEEP,
   *               so lights are grouped by it and each distinct group costs a
   *               full flood pass - measured at ~0.9ms on a 160x90 grid (1 group
   *               0.96ms, 3 groups 2.70ms, 5 groups 4.52ms). Watch
   *               `LightingSystem.GroupCount` while tuning.
   *
   *               Grouping is on the derived decay, which folds radius AND
   *               intensity together, so two lights merge into one pass only when
   *               both land on the same quantised decay. Changing either value on
   *               one of them can silently split the group and add a pass.
   * @param shape SHAPE_ROUND (default), SHAPE_SQUARE, SHAPE_DIAMOND, or any value
   *              between 1 and 2 to blend them. See the LIGHT SHAPES block above.
   */
  static AddLight(
    x: number,
    y: number,
    color: number,
    intensity: number = 1,
    radius: number = 0,
    shape: number = LightingSystem.SHAPE_ROUND
  ): void {
    if (!this.scene) return this.warnUninitialized()

    this.emitters.push({
      x,
      y,
      r: ((color >> 16) & 0xff) / 255 * intensity,
      g: ((color >> 8) & 0xff) / 255 * intensity,
      b: (color & 0xff) / 255 * intensity,
      shape,
      decay: this.decayForRadius(radius, intensity)
    })
  }

  /**
   * Solve for the per-tile decay that makes a light of `intensity` fade to the
   * ambient floor at `radius` world pixels - the point it stops being visible,
   * since UpdateAll seeds the light buffer with ambient and merges by max.
   *
   *   intensity * d^(radius / tileSize) = ambient
   *   d = (ambient / intensity) ^ (tileSize / radius)
   *
   * Quantised so two lights with near-identical radii land in the same flood
   * group instead of each paying for a pass of their own.
   */
  private static decayForRadius(radius: number, intensity: number): number {
    if (radius <= 0) return this.airDecay

    // A light no brighter than ambient is invisible anyway, and the ratio would
    // give a decay >= 1 (light that never fades, filling the whole world).
    if (intensity <= this.ambient) return this.airDecay

    const d = Math.pow(this.ambient / intensity, this.tileSize / radius)

    // Clamp below 1 so a huge radius cannot produce non-decaying light.
    return Math.round(Math.min(d, 0.995) * 200) / 200
  }

  // ============================================================
  // FRAME UPDATE
  // ============================================================

  /**
   * Flood every light added this frame and upload the result.
   * Call once per frame, AFTER all entities have had a chance to AddLight.
   */
  static UpdateAll(): void {
    if (!this.scene) return this.warnUninitialized()

    this.light.fill(this.ambient)

    // Self-illumination first, unflooded - see BakeLight().
    if (this.hasEmission) {
      const { light, emission } = this
      for (let i = 0; i < light.length; i++) {
        if (emission[i] > light[i]) light[i] = emission[i]
      }
    }

    // Both shape and radius are properties of the SWEEP rather than of an
    // individual light: shape picks the distance metric the flood measures in,
    // radius sets how fast it decays, and each governs the whole grid. So lights
    // are grouped by the (shape, decay) pair, each group floods into scratch on
    // its own, and the groups are merged by max.
    //
    // One group is the normal case and costs exactly what it did before; every
    // additional distinct pair is one more flood pass (~0.5ms).
    const groups = new Map<string, { shape: number; decay: number }>()
    for (const e of this.emitters) {
      const key = `${e.shape}|${e.decay}`
      if (!groups.has(key)) groups.set(key, { shape: e.shape, decay: e.decay })
    }

    this.lastGroupCount = groups.size

    for (const { shape, decay } of groups.values()) {
      this.scratch.fill(0)
      this.seed(shape, decay)
      this.propagate(shape, decay)
      this.merge()
    }

    this.upload()
    this.emitters.length = 0
  }

  /** Inject one group's emitters into the scratch buffer. */
  private static seed(shape: number, decay: number): void {
    const { cols, rows, scratch, tileSize } = this

    for (const e of this.emitters) {
      if (e.shape !== shape || e.decay !== decay) continue

      const tx = Math.floor(e.x / tileSize)
      const ty = Math.floor(e.y / tileSize)
      if (tx < 0 || ty < 0 || tx >= cols || ty >= rows) continue

      // max, not add: two overlapping torches should not read as one blinding
      // one. Colours still blend during propagation, per channel.
      const i = (ty * cols + tx) * 3
      if (e.r > scratch[i]) scratch[i] = e.r
      if (e.g > scratch[i + 1]) scratch[i + 1] = e.g
      if (e.b > scratch[i + 2]) scratch[i + 2] = e.b
    }
  }

  /**
   * Flood the scratch buffer outward with alternating forward/backward sweeps.
   *
   * Each tile takes the brightest of itself and its already-visited neighbours
   * scaled by THAT NEIGHBOUR's decay - light is attenuated by the medium it
   * travelled out of, which is what makes an obstacle darken the tiles beyond it
   * rather than its own face.
   *
   * Diagonal neighbours are included, attenuated by `decay ^ shape`. Without them
   * the flood measures Manhattan distance and every light comes out a diamond.
   *
   * @param groupAirDecay Open-space decay for this group, from the requested
   *        radius. The per-tile decay map is rebuilt from the occluder mask each
   *        time, since a different radius means a different map.
   */
  private static propagate(shape: number, groupAirDecay: number): void {
    const { cols, rows, decay, diagDecay, solid } = this

    // An occluder must never transmit light better than open air does, which it
    // would for a light whose radius makes air decay steeper than solidDecay.
    const groupSolidDecay = Math.min(this.solidDecay, groupAirDecay)

    // Build this group's decay map, and hoist the diagonal attenuation out of
    // the sweeps - inline it would be four Math.pow calls per tile per sweep;
    // here it is one per tile per group.
    for (let t = 0; t < decay.length; t++) {
      decay[t] = solid[t] ? groupSolidDecay : groupAirDecay
      diagDecay[t] = Math.pow(decay[t], shape)
    }

    for (let pass = 0; pass < this.iterations; pass++) {
      // Forward: left-to-right, top-to-bottom. Carries light down and right.
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const t = y * cols + x
          const i = t * 3
          const hasLeft = x > 0
          const hasUp = y > 0
          if (hasLeft) this.spread(i, (t - 1) * 3, decay[t - 1])
          if (hasUp) this.spread(i, (t - cols) * 3, decay[t - cols])
          if (hasLeft && hasUp) this.spread(i, (t - cols - 1) * 3, diagDecay[t - cols - 1])
          if (hasUp && x < cols - 1) this.spread(i, (t - cols + 1) * 3, diagDecay[t - cols + 1])
        }
      }

      // Backward: right-to-left, bottom-to-top. Carries light up and left, and
      // lets it wrap around the far side of obstacles the forward pass missed.
      for (let y = rows - 1; y >= 0; y--) {
        for (let x = cols - 1; x >= 0; x--) {
          const t = y * cols + x
          const i = t * 3
          const hasRight = x < cols - 1
          const hasDown = y < rows - 1
          if (hasRight) this.spread(i, (t + 1) * 3, decay[t + 1])
          if (hasDown) this.spread(i, (t + cols) * 3, decay[t + cols])
          if (hasRight && hasDown) this.spread(i, (t + cols + 1) * 3, diagDecay[t + cols + 1])
          if (hasDown && x > 0) this.spread(i, (t + cols - 1) * 3, diagDecay[t + cols - 1])
        }
      }
    }
  }

  /** Pull light from a neighbouring tile into this one, attenuated by `d`. */
  private static spread(i: number, ni: number, d: number): void {
    const s = this.scratch
    const r = s[ni] * d
    const g = s[ni + 1] * d
    const b = s[ni + 2] * d
    if (r > s[i]) s[i] = r
    if (g > s[i + 1]) s[i + 1] = g
    if (b > s[i + 2]) s[i + 2] = b
  }

  /** Merge the finished scratch flood into the accumulated light buffer. */
  private static merge(): void {
    const { light, scratch } = this
    for (let i = 0; i < light.length; i++) {
      if (scratch[i] > light[i]) light[i] = scratch[i]
    }
  }

  /** Write the light buffer into the canvas texture and re-upload it. */
  private static upload(): void {
    const { light, pixels, texture, imageData } = this
    if (!pixels || !texture || !imageData) return

    const n = this.cols * this.rows
    const e = this.exposure
    for (let t = 0; t < n; t++) {
      const i = t * 3
      const p = t * 4
      // Tone-map rather than clamp. A hard clamp turns any light brighter than 1
      // into a flat white disc with a hard edge - the "too bright in the lit
      // areas" problem. This rolls off smoothly and never quite reaches 1, so a
      // bright centre still reads as a gradient.
      pixels[p] = (1 - Math.exp(-light[i] * e)) * 255
      pixels[p + 1] = (1 - Math.exp(-light[i + 1] * e)) * 255
      pixels[p + 2] = (1 - Math.exp(-light[i + 2] * e)) * 255
    }

    texture.context.putImageData(imageData, 0, 0)
    texture.refresh()
  }

  // ============================================================
  // TEARDOWN
  // ============================================================

  /** Tear down the overlay and texture. Called automatically by Initialize(). */
  static Clear(): void {
    this.overlay?.destroy()
    this.overlay = null

    if (this.scene?.textures.exists(LightingSystem.TEXTURE_KEY)) {
      this.scene.textures.remove(LightingSystem.TEXTURE_KEY)
    }

    this.texture = null
    this.imageData = null
    this.pixels = null
    this.emitters.length = 0
    this.hasEmission = false
    this.scene = null
  }

  private static warnUninitialized(): void {
    if (this.warnedUninitialized) return
    this.warnedUninitialized = true
    console.warn('[LightingSystem] Not initialized - call LightingSystem.Initialize(scene) first.')
  }
}
