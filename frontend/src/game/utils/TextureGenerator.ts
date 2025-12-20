import Phaser from 'phaser'

/**
 * ============================================================================
 * TextureGenerator - On-Demand Cached Texture System
 * ============================================================================
 *
 * This system generates textures on-demand and caches them for reuse.
 * It mimics the Graphics API but is optimized by caching textures.
 *
 * USAGE (similar to Graphics):
 * ```typescript
 * // Get or create a texture (cached automatically)
 * const key = TextureGenerator.getOrCreateCircle(this.scene, {
 *   radius: 20,
 *   fillColor: 0xffffff,
 *   fillAlpha: 1.0,
 *   strokeWidth: 2,
 *   strokeColor: 0xffffff,
 *   strokeAlpha: 0.8
 * })
 *
 * // Create sprite with texture (or reuse existing)
 * if (!this.sprite) {
 *   this.sprite = this.scene.add.sprite(0, 0, key)
 *   this.container.add(this.sprite)
 * }
 *
 * // Update sprite properties (dynamic)
 * this.sprite.setTint(this.color)
 * this.sprite.setRotation(this.rotation)
 * this.sprite.setAlpha(this.alpha)
 * ```
 */
export class TextureGenerator {
  /**
   * Resolution multiplier for high-quality textures.
   * All textures are generated at this scale to avoid pixelation.
   * Sprites are automatically scaled down when created.
   */
  private static readonly TEXTURE_SCALE = 4

  /**
   * Get the scale factor to apply to sprites created from TextureGenerator.
   * This ensures sprites display at the correct size despite high-res textures.
   *
   * Usage: sprite.setScale(TextureGenerator.getDisplayScale())
   */
  static getDisplayScale(): number {
    return 1 / this.TEXTURE_SCALE
  }

  /**
   * ========================================================================
   * CIRCLE TEXTURE GENERATION
   * ========================================================================
   *
   * Generates a circle texture with customizable fill and stroke.
   * Textures are cached by their parameters for reuse.
   *
   * @returns Texture key for use with scene.add.sprite()
   */
  static getOrCreateCircle(
    scene: Phaser.Scene,
    options: {
      radius: number
      fillColor?: number      // Fill color (default: 0xffffff white)
      fillAlpha?: number      // Fill opacity 0-1 (default: 1.0)
      strokeWidth?: number    // Stroke width in pixels (default: 0, no stroke)
      strokeColor?: number    // Stroke color (default: 0xffffff white)
      strokeAlpha?: number    // Stroke opacity 0-1 (default: 1.0)
      glowRadius?: number     // Optional outer glow radius (default: 0, no glow)
      glowAlpha?: number      // Glow opacity 0-1 (default: 0.3)
    }
  ): string {
    const {
      radius,
      fillColor = 0xffffff,
      fillAlpha = 1.0,
      strokeWidth = 0,
      strokeColor = 0xffffff,
      strokeAlpha = 1.0,
      glowRadius = 0,
      glowAlpha = 0.3
    } = options

    // Generate unique key based on all parameters (at original size, not scaled)
    const key = `circle_${radius}_f${fillColor.toString(16)}_${fillAlpha}_s${strokeWidth}_${strokeColor.toString(16)}_${strokeAlpha}_g${glowRadius}_${glowAlpha}`

    // Return if already exists
    if (scene.textures.exists(key)) return key

    // Scale all dimensions for high-resolution texture
    const scaledRadius = radius * this.TEXTURE_SCALE
    const scaledGlowRadius = glowRadius * this.TEXTURE_SCALE
    const scaledStrokeWidth = strokeWidth * this.TEXTURE_SCALE

    // Calculate canvas size
    const maxRadius = Math.max(scaledRadius, scaledRadius + scaledGlowRadius)
    const padding = scaledStrokeWidth + 4 * this.TEXTURE_SCALE
    const size = Math.ceil(maxRadius * 2 + padding * 2)
    const centerX = size / 2
    const centerY = size / 2

    const graphics = scene.add.graphics()

    // Draw glow if specified
    if (glowRadius > 0) {
      graphics.fillStyle(fillColor, glowAlpha)
      graphics.fillCircle(centerX, centerY, scaledRadius + scaledGlowRadius)
    }

    // Draw main circle
    graphics.fillStyle(fillColor, fillAlpha)
    if (strokeWidth > 0) {
      graphics.lineStyle(scaledStrokeWidth, strokeColor, strokeAlpha)
    }
    graphics.fillCircle(centerX, centerY, scaledRadius)
    if (strokeWidth > 0) {
      graphics.strokeCircle(centerX, centerY, scaledRadius)
    }

    // Render to texture
    const renderTexture = scene.add.renderTexture(0, 0, size, size)
    renderTexture.draw(graphics, 0, 0)
    renderTexture.saveTexture(key)

    // Clean up
    renderTexture.destroy()
    graphics.destroy()

    return key
  }

  /**
   * ========================================================================
   * POLYGON TEXTURE GENERATION
   * ========================================================================
   *
   * Generates a polygon texture with customizable fill and stroke.
   * Textures are cached by their parameters for reuse.
   *
   * @returns Texture key for use with scene.add.sprite()
   */
  static getOrCreatePolygon(
    scene: Phaser.Scene,
    options: {
      sides: number
      radius: number
      fillColor?: number      // Fill color (default: 0xffffff white)
      fillAlpha?: number      // Fill opacity 0-1 (default: 1.0)
      strokeWidth?: number    // Stroke width in pixels (default: 0, no stroke)
      strokeColor?: number    // Stroke color (default: 0xffffff white)
      strokeAlpha?: number    // Stroke opacity 0-1 (default: 1.0)
      rotation?: number       // Initial rotation offset in radians (default: -Math.PI/2, pointing up)
    }
  ): string {
    const {
      sides,
      radius,
      fillColor = 0xffffff,
      fillAlpha = 1.0,
      strokeWidth = 0,
      strokeColor = 0xffffff,
      strokeAlpha = 1.0,
      rotation = -Math.PI / 2
    } = options

    // Generate unique key based on all parameters (at original size, not scaled)
    const key = `poly_${sides}_${radius}_f${fillColor.toString(16)}_${fillAlpha}_s${strokeWidth}_${strokeColor.toString(16)}_${strokeAlpha}_r${rotation.toFixed(2)}`

    // Return if already exists
    if (scene.textures.exists(key)) return key

    // Scale all dimensions for high-resolution texture
    const scaledRadius = radius * this.TEXTURE_SCALE
    const scaledStrokeWidth = strokeWidth * this.TEXTURE_SCALE

    // Calculate canvas size
    const padding = scaledStrokeWidth + 10 * this.TEXTURE_SCALE
    const size = Math.ceil(scaledRadius * 2 + padding * 2)
    const centerX = size / 2
    const centerY = size / 2

    // Calculate vertices
    const vertices: Phaser.Math.Vector2[] = []
    const angleStep = (Math.PI * 2) / sides

    for (let i = 0; i < sides; i++) {
      const angle = angleStep * i + rotation
      vertices.push(
        new Phaser.Math.Vector2(
          centerX + Math.cos(angle) * scaledRadius,
          centerY + Math.sin(angle) * scaledRadius
        )
      )
    }

    const graphics = scene.add.graphics()

    // Draw polygon
    graphics.fillStyle(fillColor, fillAlpha)
    if (strokeWidth > 0) {
      graphics.lineStyle(scaledStrokeWidth, strokeColor, strokeAlpha)
    }

    graphics.beginPath()
    graphics.moveTo(vertices[0].x, vertices[0].y)
    for (let i = 1; i < vertices.length; i++) {
      graphics.lineTo(vertices[i].x, vertices[i].y)
    }
    graphics.closePath()
    graphics.fillPath()
    if (strokeWidth > 0) {
      graphics.strokePath()
    }

    // Render to texture
    const renderTexture = scene.add.renderTexture(0, 0, size, size)
    renderTexture.draw(graphics, 0, 0)
    renderTexture.saveTexture(key)

    // Clean up
    renderTexture.destroy()
    graphics.destroy()

    return key
  }

  /**
   * ========================================================================
   * DIAMOND (RHOMBUS) TEXTURE GENERATION
   * ========================================================================
   */
  static getOrCreateDiamond(
    scene: Phaser.Scene,
    options: {
      radius: number
      fillColor?: number
      fillAlpha?: number
      strokeWidth?: number
      strokeColor?: number
      strokeAlpha?: number
      horizontalScale?: number  // Width scale (default: 0.6 for rhombus shape)
    }
  ): string {
    const {
      radius,
      fillColor = 0xffffff,
      fillAlpha = 1.0,
      strokeWidth = 0,
      strokeColor = 0xffffff,
      strokeAlpha = 1.0,
      horizontalScale = 0.6
    } = options

    const key = `diamond_${radius}_f${fillColor.toString(16)}_${fillAlpha}_s${strokeWidth}_${strokeColor.toString(16)}_${strokeAlpha}_h${horizontalScale}`

    if (scene.textures.exists(key)) return key

    // Scale all dimensions for high-resolution texture
    const scaledRadius = radius * this.TEXTURE_SCALE
    const scaledStrokeWidth = strokeWidth * this.TEXTURE_SCALE

    const padding = scaledStrokeWidth + 10 * this.TEXTURE_SCALE
    const size = Math.ceil(scaledRadius * 2 + padding * 2)
    const centerX = size / 2
    const centerY = size / 2

    const graphics = scene.add.graphics()

    // Diamond vertices (rhombus)
    const vertices: Phaser.Math.Vector2[] = [
      new Phaser.Math.Vector2(centerX, centerY - scaledRadius),                    // Top
      new Phaser.Math.Vector2(centerX + scaledRadius * horizontalScale, centerY),  // Right
      new Phaser.Math.Vector2(centerX, centerY + scaledRadius),                    // Bottom
      new Phaser.Math.Vector2(centerX - scaledRadius * horizontalScale, centerY)   // Left
    ]

    graphics.fillStyle(fillColor, fillAlpha)
    if (strokeWidth > 0) {
      graphics.lineStyle(scaledStrokeWidth, strokeColor, strokeAlpha)
    }

    graphics.beginPath()
    graphics.moveTo(vertices[0].x, vertices[0].y)
    for (let i = 1; i < vertices.length; i++) {
      graphics.lineTo(vertices[i].x, vertices[i].y)
    }
    graphics.closePath()
    graphics.fillPath()
    if (strokeWidth > 0) {
      graphics.strokePath()
    }

    const renderTexture = scene.add.renderTexture(0, 0, size, size)
    renderTexture.draw(graphics, 0, 0)
    renderTexture.saveTexture(key)

    renderTexture.destroy()
    graphics.destroy()

    return key
  }

  /**
   * ========================================================================
   * HELPER: Get or create circle with smart sizing
   * ========================================================================
   *
   * Returns a texture key and scale multiplier for the requested size.
   * Uses pre-generated sizes when possible, or creates on-demand.
   */
  static getCircleTextureWithScale(
    scene: Phaser.Scene,
    desiredRadius: number,
    options?: {
      fillColor?: number
      fillAlpha?: number
      strokeWidth?: number
      strokeColor?: number
      strokeAlpha?: number
    }
  ): { key: string; scale: number } {
    // Common sizes for optimization (pre-generate these)
    const commonSizes = [5, 10, 20, 40, 80]
    const closest = commonSizes.reduce((prev, curr) =>
      Math.abs(curr - desiredRadius) < Math.abs(prev - desiredRadius) ? curr : prev
    )

    // Use closest size if within 20% tolerance
    const tolerance = 0.2
    if (Math.abs(closest - desiredRadius) / desiredRadius <= tolerance) {
      const key = this.getOrCreateCircle(scene, { radius: closest, ...options })
      const scale = desiredRadius / closest
      return { key, scale }
    }

    // Otherwise create exact size
    const key = this.getOrCreateCircle(scene, { radius: desiredRadius, ...options })
    return { key, scale: 1.0 }
  }

  /**
   * ========================================================================
   * HELPER: Get polygon texture key
   * ========================================================================
   */
  static getPolygonTextureKey(sides: number, isPlayer: boolean = false): string {
    const clampedSides = Math.max(3, Math.min(20, Math.round(sides)))
    return isPlayer ? `polygon_${clampedSides}_player` : `polygon_${clampedSides}`
  }

  /**
   * ========================================================================
   * STARTUP: Pre-generate common textures for performance
   * ========================================================================
   *
   * Call this once in MainScene.create() to pre-generate commonly used textures.
   */
  static generateCommonTextures(scene: Phaser.Scene): void {
    console.log('Pre-generating common textures...')

    // Pre-generate common enemy polygons (gray fill + white stroke for visible borders)
    for (let sides = 3; sides <= 20; sides++) {
      this.getOrCreatePolygon(scene, {
        sides,
        radius: 40,
        fillColor: 0xd9d9d9,  // Light gray for contrast when tinted
        fillAlpha: 1.0,
        strokeWidth: 3,
        strokeColor: 0xffffff,
        strokeAlpha: 1.0
      })

      // Also generate outline-only versions for Super variants
      this.getOrCreatePolygon(scene, {
        sides,
        radius: 46,  // Slightly larger for outer outline
        fillColor: 0xffffff,
        fillAlpha: 0,  // No fill, outline only
        strokeWidth: 1.5,
        strokeColor: 0xffffff,
        strokeAlpha: 0.8
      })
    }

    // Pre-generate common projectile circles
    const sizes = [5, 8, 10, 15, 20, 40]
    for (const size of sizes) {
      // Regular circles with glow
      this.getOrCreateCircle(scene, {
        radius: size,
        fillColor: 0xffffff,
        fillAlpha: 1.0,
        glowRadius: size * 0.5,
        glowAlpha: 0.3
      })
    }

    // Pre-generate diamond shape
    this.getOrCreateDiamond(scene, {
      radius: 40,
      fillColor: 0xd9d9d9,
      fillAlpha: 1.0,
      strokeWidth: 3,
      strokeColor: 0xffffff,
      strokeAlpha: 1.0
    })

    // Diamond outline for super variant (if needed)
    this.getOrCreateDiamond(scene, {
      radius: 46,
      fillColor: 0xffffff,
      fillAlpha: 0,
      strokeWidth: 1.5,
      strokeColor: 0xffffff,
      strokeAlpha: 0.8
    })

    // Semi-transparent explosion texture
    this.getOrCreateCircle(scene, {
      radius: 40,
      fillColor: 0xffffff,
      fillAlpha: 0.3,
      glowRadius: 8,
      glowAlpha: 0.15
    })

    console.log('✓ Common textures pre-generated!')
  }
}
