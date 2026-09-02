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
 *
 * ----------------------------------------------------------------------------
 * INTENSITY IS THE ONLY KNOB
 *
 * There is no per-light radius. A sweep has exactly ONE decay rate, and decay is
 * what sets how far light travels, so a light asking for its own radius asks for
 * its own full-grid flood pass. An earlier version did offer one, and a single
 * boss whose 12 segments each derived a radius from their own size cost 12
 * passes and ~12ms a frame.
 *
 * So, as in Terraria: one global `airDecay`, and reach emerges from how much
 * brightness a light injects.
 *
 *   reach = tileSize * ln(ambient / intensity) / ln(airDecay)
 *
 * Two consequences worth internalising:
 *
 * 1. LIGHT COUNT AND BRIGHTNESS ARE BOTH FREE. 2000 lights of 40 different
 *    intensities cost exactly one pass, the same as one light. Vary intensity
 *    per entity as freely as you like.
 *
 * 2. REACH IS LOGARITHMIC IN INTENSITY, so size is the expensive axis. Reach
 *    goes as `ln(intensity) - ln(ambient)`, which at the shipped settings means:
 *
 *      intensity  0.5    1     2     4     8     40
 *      reach      134   192   249   307   364   498  (px)
 *      centre    0.39  0.63  0.86  0.98  1.00  1.00  (after tone mapping)
 *
 *    Doubling intensity adds a FLAT ~58px, every time. Going from 250px to
 *    500px costs 20x the intensity.
 *
 *    Note the two columns saturating at different rates. Below ~2, intensity is
 *    mostly a BRIGHTNESS control - the centre climbs fast and the radius barely
 *    moves. Above ~3 the centre is pinned at white and intensity is mostly a
 *    SIZE control, bought at a steep exchange rate.
 *
 *    That is physically the right behaviour - a brighter lamp does blow out its
 *    core and spread its glow - but it means you cannot make a light twice as
 *    big without making it look blown out. To change everything's size at once,
 *    move `airDecay` instead; to shift the whole curve's shape, move `ambient`,
 *    which sets the `-ln(ambient)` constant above.
 *
 * Use LightingSystem.Reach(i) and LightingSystem.IntensityFor(px) rather than
 * eyeballing this.
 *
 * ----------------------------------------------------------------------------
 * VIEWPORT CULLING
 *
 * Cost is tied to SCREEN area, not world area. Two independent mechanisms:
 *
 * 1. EMITTER CULLING. AddLight drops any light whose reach cannot touch the
 *    padded camera rect. An off-screen enemy emits nothing - the same rule
 *    Terraria uses. This is the one that matters most, because a dropped light
 *    also cannot open a flood group of its own (see AddLight's radius note), and
 *    groups are the system's real cost driver.
 *
 * 2. FLOOD WINDOWING. Every buffer pass - clear, seed, sweep, merge, upload -
 *    runs over a tile window around the camera instead of the whole grid.
 *
 * The window is the camera rect grown by `cullPadding` PLUS the distance of the
 * furthest surviving emitter outside the view, so an off-screen light still has
 * its own tile inside the window and a path from there to the screen.
 *
 * Note what that margin is NOT: it is not the largest light RADIUS. A light
 * inside the view needs no margin at all, because the flood only has to be
 * correct where it is visible - what that light does to tiles off-screen is
 * never sampled. Sizing the margin by radius instead would grow the window past
 * the whole grid here and save nothing.
 *
 * The cost is that light no longer routes far outside the view and back, which
 * would only matter for an obstacle sitting right on the screen edge, and
 * `cullPadding` covers that.
 *
 * Tiles outside the window keep stale values from earlier frames. That is safe
 * ONLY because the window always contains the camera rect with padding to spare,
 * so nothing stale is ever on screen - including under the overlay's bilinear
 * filtering, which reaches one texel past what it samples. Anything that widens
 * what the overlay shows (a camera zoom-out, a larger displayed size) has to
 * widen the window with it.
 */

/** A light added this frame. Cleared by every UpdateAll(). */
interface Emitter {
  x: number
  y: number
  r: number
  g: number
  b: number
  /**
   * Distance metric for this light's falloff. The only per-light property that
   * is also a property of the SWEEP, so lights sharing a shape flood together
   * and each distinct shape costs a pass - see UpdateAll().
   */
  shape: number
}

export interface LightingOptions {
  /** World pixels per light tile. Terraria uses 16. Smaller = sharper, costlier. */
  tileSize?: number
  /**
   * Per-tile survival fraction through open space, and the GLOBAL SIZE CONTROL
   * for every light in the game. A light fades from `intensity` to `ambient`
   * after `log(ambient / intensity) / log(airDecay)` tiles.
   *
   * There is exactly one of these because a sweep has exactly one decay rate -
   * that is what keeps the whole game at a single flood pass. Lower it to shrink
   * every light at once, raise it to grow them; per-light size is `intensity`.
   *
   * The default 0.825 puts an intensity-2 light at ~250px and an intensity-0.7
   * light at ~160px, which is where the game's entity and projectile lights sat
   * under the old per-light radius parameter.
   *
   * Must be below 1. At 1 light never fades and floods the entire world.
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
  /**
   * Slack in world pixels around the camera, used by viewport culling for two
   * things: how far outside the view a light may sit and still be kept, and how
   * far past the view the flood window extends. See VIEWPORT CULLING.
   *
   * It absorbs the one-frame lag in the camera rect and gives light a few tiles
   * of off-screen room to route around obstacles near the edge. Raising it costs
   * flood area; lowering it below ~64 risks light popping at the screen edge.
   */
  cullPadding?: number
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
  private static airDecay = 0.825
  private static solidDecay = 0.15
  private static ambient = 0.38
  private static iterations = 2
  private static exposure = 1
  private static cullPadding = 96

  private static cols = 0
  private static rows = 0

  // ---- Viewport culling state (see VIEWPORT CULLING) ----

  /**
   * Camera rect in world pixels, cached once per frame.
   *
   * Phaser updates `camera.worldView` during render, which happens AFTER
   * scene.update() - so every AddLight this frame reads LAST frame's rect. With
   * the follow lerp that is a handful of pixels, and `cullPadding` absorbs it.
   */
  private static viewL = 0
  private static viewT = 0
  private static viewR = 0
  private static viewB = 0
  /** Game frame the rect above was sampled on, so we sample it once per frame. */
  private static viewFrame = -1

  /**
   * Furthest any surviving emitter sits outside the camera rect this frame, in
   * world pixels (Chebyshev, matching the rectangular window). Accumulated by
   * AddLight, consumed by computeWindow, reset by UpdateAll.
   */
  private static maxOutside = 0

  /** Inclusive tile bounds of the region flooded this frame. */
  private static winX0 = 0
  private static winY0 = 0
  private static winX1 = 0
  private static winY1 = 0

  /** Lights kept / dropped last frame, and window size. Exposed for the perf HUD. */
  private static lastLightCount = 0
  private static lastCulledCount = 0
  private static lastWindowTiles = 0
  /**
   * Culled lights so far this frame. Snapshotted into lastCulledCount by
   * UpdateAll, because the HUD reads the getters AFTER UpdateAll has run and a
   * counter reset in place would always read zero.
   */
  private static culledThisFrame = 0

  /** Final light level per tile, 3 floats (RGB) per tile. */
  private static light: Float32Array
  /** Scratch buffer for one shape group's flood, before it is merged into `light`. */
  private static scratch: Float32Array
  /**
   * Per-tile occluder flag - the durable geometry, baked once by SetOccluders.
   *
   * There is deliberately no per-tile DECAY array beside it. With one global
   * decay rate a tile's decay is one of exactly two numbers, so propagate()
   * carries them as scalars and branches on this mask. The per-tile version cost
   * a 14,400-entry rebuild with a Math.pow per tile, per group, per frame.
   */
  private static solid: Uint8Array
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
    // Below 1, or light never fades and the first flood fills the whole world.
    this.airDecay = Math.min(options.airDecay ?? 0.825, 0.995)
    this.solidDecay = options.solidDecay ?? 0.15
    this.ambient = options.ambient ?? 0.38
    this.iterations = options.iterations ?? 2
    this.exposure = options.exposure ?? 1
    this.cullPadding = options.cullPadding ?? 96

    this.cols = Math.ceil(WORLD_WIDTH / this.tileSize)
    this.rows = Math.ceil(WORLD_HEIGHT / this.tileSize)

    // Start with the window covering everything. The first UpdateAll narrows it,
    // but BakeLight and SetOccluders may run before then and write world-wide.
    this.viewFrame = -1
    this.maxOutside = 0
    this.winX0 = 0
    this.winY0 = 0
    this.winX1 = this.cols - 1
    this.winY1 = this.rows - 1
    this.lastLightCount = 0
    this.lastCulledCount = 0
    this.lastWindowTiles = 0
    this.culledThisFrame = 0

    const tiles = this.cols * this.rows
    this.light = new Float32Array(tiles * 3)
    this.scratch = new Float32Array(tiles * 3)
    this.solid = new Uint8Array(tiles)
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

  /** Lights that survived viewport culling on the last UpdateAll(). */
  static get LightCount(): number {
    return this.lastLightCount
  }

  /**
   * Lights dropped by viewport culling on the last UpdateAll(). Non-zero means
   * culling is doing something; a flat zero on a big map means every emitter is
   * on screen, or that the camera rect is not being read (see refreshView).
   */
  static get CulledCount(): number {
    return this.lastCulledCount
  }

  /**
   * Tiles the last flood actually swept, against `cols * rows` for the whole
   * grid. This is the per-group cost multiplier - halve it and every group gets
   * twice as cheap.
   */
  static get WindowTiles(): number {
    return this.lastWindowTiles
  }

  /** Total tiles in the grid, as the denominator for WindowTiles. */
  static get TotalTiles(): number {
    return this.cols * this.rows
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
   * Callers do NOT need to check whether they are on screen: a light that cannot
   * reach the camera is dropped here (see VIEWPORT CULLING), which also stops it
   * opening a flood group of its own. Call this unconditionally.
   *
   * @param color Light colour as 0xRRGGBB.
   * @param intensity Brightness at the source, and the ONLY size control - see
   *                  INTENSITY IS THE ONLY KNOB above. ~0.7 is a projectile
   *                  glow, ~2 a player or enemy. Values above 1 are fine; the
   *                  centre rolls off toward white rather than clamping (see
   *                  `exposure`), and past ~3 the centre is saturated and extra
   *                  intensity buys reach rather than brightness.
   *
   *                  Free to vary: it does NOT split the flood into more passes.
   * @param shape SHAPE_ROUND (default), SHAPE_SQUARE, SHAPE_DIAMOND, or any value
   *              between 1 and 2 to blend them. See the LIGHT SHAPES block above.
   *
   *              This is the one property that IS a property of the sweep, so
   *              each distinct shape in a frame costs a full flood pass. Leaving
   *              it alone keeps the whole game at one pass. Watch
   *              `LightingSystem.GroupCount`.
   */
  static AddLight(
    x: number,
    y: number,
    color: number,
    intensity: number = 1,
    shape: number = LightingSystem.SHAPE_ROUND
  ): void {
    if (!this.scene) return this.warnUninitialized()

    const r = ((color >> 16) & 0xff) / 255 * intensity
    const g = ((color >> 8) & 0xff) / 255 * intensity
    const b = (color & 0xff) / 255 * intensity

    // ---- Viewport cull ----
    this.refreshView()

    const pad = this.cullPadding
    const reach = this.reachForIntensity(Math.max(r, g, b))

    if (
      x + reach < this.viewL - pad ||
      x - reach > this.viewR + pad ||
      y + reach < this.viewT - pad ||
      y - reach > this.viewB + pad
    ) {
      this.culledThisFrame++
      return
    }

    // How far outside the view this light sits. The window has to reach its tile
    // or seed() would drop it, so the furthest survivor sets the window margin.
    const outside = Math.max(
      this.viewL - x,
      x - this.viewR,
      this.viewT - y,
      y - this.viewB,
      0
    )
    if (outside > this.maxOutside) this.maxOutside = outside

    this.emitters.push({ x, y, r, g, b, shape })
  }

  /**
   * How far a light of this brightness carries, in world pixels - the point it
   * falls to the ambient floor and stops contributing anything, since UpdateAll
   * seeds the buffer with ambient and merges by max.
   *
   * Solving `intensity * airDecay^n = ambient` for n:
   *
   *   reach = tileSize * ln(ambient / intensity) / ln(airDecay)
   *
   * Used for viewport culling, and it is also the formula to reach for when
   * picking an intensity - see Reach() for the public version.
   */
  private static reachForIntensity(intensity: number): number {
    const cap = WORLD_WIDTH + WORLD_HEIGHT

    // Never brighter than the floor it decays to, so it is invisible everywhere.
    if (intensity <= this.ambient) return 0

    // Guard the log: airDecay is validated below 1 in Initialize, but a
    // non-decaying light would divide by ~0 and reach forever.
    if (this.airDecay >= 1) return cap

    const tiles = Math.log(this.ambient / intensity) / Math.log(this.airDecay)
    return Math.min(tiles * this.tileSize, cap)
  }

  /**
   * World-pixel reach of a light at this intensity, under the current settings.
   *
   * Exposed because intensity is now the only size control and the mapping is
   * logarithmic, so it is not something to eyeball. Use it to check a value:
   * `LightingSystem.Reach(2)` is ~250px at the shipped configuration.
   *
   * The inverse - what intensity gives a target reach - is IntensityFor().
   */
  static Reach(intensity: number): number {
    return this.reachForIntensity(intensity)
  }

  /**
   * Intensity needed for a light to reach `radius` world pixels.
   *
   * The replacement for the old `radius` argument, but resolved at AUTHORING
   * time rather than per frame: pick your number once, hard-code the intensity
   * it gives you. Nothing about it splits a flood pass, so unlike the old
   * parameter it is free to vary per entity.
   *
   * Beware the shape of it. Reach goes as `ln(intensity) - ln(ambient)`, so it
   * is logarithmic: at the shipped settings, intensity 2 reaches ~250px and it
   * takes intensity ~41 to reach 500px - long past the point the centre is a
   * blown-out white disc. Doubling a light's size is expensive; nudging it is
   * cheap. See INTENSITY IS THE ONLY KNOB.
   */
  static IntensityFor(radius: number): number {
    if (radius <= 0) return 0
    return this.ambient / Math.pow(this.airDecay, radius / this.tileSize)
  }

  /**
   * Sample the camera rect, once per frame.
   *
   * A zero-size worldView (before the first render, or a torn-down camera) falls
   * back to the whole world, which cleanly disables both culling and windowing
   * for that frame rather than blacking the screen out.
   */
  private static refreshView(): void {
    const scene = this.scene
    if (!scene) return

    const frame = scene.game.loop.frame
    if (frame === this.viewFrame) return
    this.viewFrame = frame

    const view = scene.cameras?.main?.worldView
    if (!view || view.width <= 0 || view.height <= 0) {
      this.viewL = 0
      this.viewT = 0
      this.viewR = WORLD_WIDTH
      this.viewB = WORLD_HEIGHT
      return
    }

    this.viewL = view.x
    this.viewT = view.y
    this.viewR = view.right
    this.viewB = view.bottom
  }

  /**
   * Size the flood window to the camera rect plus `cullPadding` plus the
   * furthest surviving emitter outside the view. See VIEWPORT CULLING for why
   * the margin is emitter DISTANCE and not light radius.
   */
  private static computeWindow(): void {
    this.refreshView()

    const { tileSize, cols, rows } = this
    const margin = this.maxOutside + this.cullPadding

    this.winX0 = Math.max(0, Math.floor((this.viewL - margin) / tileSize))
    this.winY0 = Math.max(0, Math.floor((this.viewT - margin) / tileSize))
    this.winX1 = Math.min(cols - 1, Math.floor((this.viewR + margin) / tileSize))
    this.winY1 = Math.min(rows - 1, Math.floor((this.viewB + margin) / tileSize))

    this.lastWindowTiles = (this.winX1 - this.winX0 + 1) * (this.winY1 - this.winY0 + 1)
  }

  /**
   * Fill the window's rows of an RGB buffer, one contiguous run per row.
   * The buffer is 3 floats per tile, so a row spans [winX0, winX1] * 3.
   */
  private static fillWindow(buffer: Float32Array, value: number): void {
    const { cols, winX0, winX1, winY0, winY1 } = this
    for (let y = winY0; y <= winY1; y++) {
      const row = y * cols
      buffer.fill(value, (row + winX0) * 3, (row + winX1 + 1) * 3)
    }
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

    // Everything below runs over the camera window only - see VIEWPORT CULLING.
    // Must be computed before the first buffer touch, since it defines "window".
    this.computeWindow()

    this.fillWindow(this.light, this.ambient)

    // Self-illumination first, unflooded - see BakeLight(). Baked world-wide,
    // read back only where it is visible.
    if (this.hasEmission) {
      const { light, emission, cols, winX0, winX1, winY0, winY1 } = this
      for (let y = winY0; y <= winY1; y++) {
        const start = (y * cols + winX0) * 3
        const end = (y * cols + winX1 + 1) * 3
        for (let i = start; i < end; i++) {
          if (emission[i] > light[i]) light[i] = emission[i]
        }
      }
    }

    // SHAPE is the only property of the SWEEP rather than of an individual
    // light: it picks the distance metric the flood measures in, and that metric
    // governs the whole grid. So lights are grouped by shape, each group floods
    // into scratch on its own, and the groups are merged by max.
    //
    // Since every light in the game uses SHAPE_ROUND, this is one group and one
    // pass no matter how many lights or how bright they are. Intensity is
    // deliberately NOT a grouping key - see INTENSITY IS THE ONLY KNOB.
    const shapes = new Set<number>()
    for (const e of this.emitters) shapes.add(e.shape)

    this.lastGroupCount = shapes.size
    this.lastLightCount = this.emitters.length

    for (const shape of shapes) {
      this.fillWindow(this.scratch, 0)
      this.seed(shape)
      this.propagate(shape)
      this.merge()
    }

    this.upload()

    this.emitters.length = 0
    this.maxOutside = 0
    this.lastCulledCount = this.culledThisFrame
    this.culledThisFrame = 0
  }

  /** Inject one group's emitters into the scratch buffer. */
  private static seed(shape: number): void {
    const { cols, scratch, tileSize, winX0, winX1, winY0, winY1 } = this

    for (const e of this.emitters) {
      if (e.shape !== shape) continue

      const tx = Math.floor(e.x / tileSize)
      const ty = Math.floor(e.y / tileSize)

      // Window bounds, not grid bounds: outside the window the scratch buffer is
      // neither cleared nor swept, so seeding there would leave a stale bright
      // tile behind for later frames to pick up.
      if (tx < winX0 || tx > winX1 || ty < winY0 || ty > winY1) continue

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
   */
  private static propagate(shape: number): void {
    const { cols, solid, winX0, winX1, winY0, winY1 } = this

    // Four scalars replace what used to be two 14,400-entry arrays rebuilt every
    // group: with one global decay rate, a tile's decay is `air` or `solid`, and
    // the diagonal versions are those two raised to `shape`. That turns a
    // per-tile Math.pow rebuild into four, and each inner-loop attenuation
    // lookup into a Uint8Array read.
    const air = this.airDecay
    // An occluder must never transmit light better than open air does.
    const sol = Math.min(this.solidDecay, air)
    const airDiag = Math.pow(air, shape)
    const solDiag = Math.pow(sol, shape)

    // Sweeps stay strictly inside the window. Neighbour tests are against the
    // window edges rather than the grid edges because tiles beyond the window
    // hold stale scratch values - reading one would pull last frame's light in.
    for (let pass = 0; pass < this.iterations; pass++) {
      // Forward: left-to-right, top-to-bottom. Carries light down and right.
      for (let y = winY0; y <= winY1; y++) {
        for (let x = winX0; x <= winX1; x++) {
          const t = y * cols + x
          const i = t * 3
          const hasLeft = x > winX0
          const hasUp = y > winY0
          if (hasLeft) this.spread(i, (t - 1) * 3, solid[t - 1] ? sol : air)
          if (hasUp) this.spread(i, (t - cols) * 3, solid[t - cols] ? sol : air)
          if (hasLeft && hasUp) {
            this.spread(i, (t - cols - 1) * 3, solid[t - cols - 1] ? solDiag : airDiag)
          }
          if (hasUp && x < winX1) {
            this.spread(i, (t - cols + 1) * 3, solid[t - cols + 1] ? solDiag : airDiag)
          }
        }
      }

      // Backward: right-to-left, bottom-to-top. Carries light up and left, and
      // lets it wrap around the far side of obstacles the forward pass missed.
      for (let y = winY1; y >= winY0; y--) {
        for (let x = winX1; x >= winX0; x--) {
          const t = y * cols + x
          const i = t * 3
          const hasRight = x < winX1
          const hasDown = y < winY1
          if (hasRight) this.spread(i, (t + 1) * 3, solid[t + 1] ? sol : air)
          if (hasDown) this.spread(i, (t + cols) * 3, solid[t + cols] ? sol : air)
          if (hasRight && hasDown) {
            this.spread(i, (t + cols + 1) * 3, solid[t + cols + 1] ? solDiag : airDiag)
          }
          if (hasDown && x > winX0) {
            this.spread(i, (t + cols - 1) * 3, solid[t + cols - 1] ? solDiag : airDiag)
          }
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
    const { light, scratch, cols, winX0, winX1, winY0, winY1 } = this
    for (let y = winY0; y <= winY1; y++) {
      const start = (y * cols + winX0) * 3
      const end = (y * cols + winX1 + 1) * 3
      for (let i = start; i < end; i++) {
        if (scratch[i] > light[i]) light[i] = scratch[i]
      }
    }
  }

  /** Write the light buffer into the canvas texture and re-upload it. */
  private static upload(): void {
    const { light, pixels, texture, imageData, cols, winX0, winX1, winY0, winY1 } = this
    if (!pixels || !texture || !imageData) return

    const e = this.exposure
    for (let y = winY0; y <= winY1; y++) {
      const row = y * cols
      for (let x = winX0; x <= winX1; x++) {
        const t = row + x
        const i = t * 3
        const p = t * 4
        // Tone-map rather than clamp. A hard clamp turns any light brighter than
        // 1 into a flat white disc with a hard edge - the "too bright in the lit
        // areas" problem. This rolls off smoothly and never quite reaches 1, so a
        // bright centre still reads as a gradient.
        pixels[p] = (1 - Math.exp(-light[i] * e)) * 255
        pixels[p + 1] = (1 - Math.exp(-light[i + 1] * e)) * 255
        pixels[p + 2] = (1 - Math.exp(-light[i + 2] * e)) * 255
      }
    }

    // Dirty-rect upload: outside the window the pixel buffer holds stale values
    // that were never recomputed, so writing them back would be wasted work. The
    // canvas keeps whatever it had there, which is off-screen by construction.
    texture.context.putImageData(
      imageData,
      0,
      0,
      winX0,
      winY0,
      winX1 - winX0 + 1,
      winY1 - winY0 + 1
    )
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
