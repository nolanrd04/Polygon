import Phaser from 'phaser'
import { DEV_SETTINGS } from '../../core/GameConfig'
import { TextureGenerator } from '../../utils/TextureGenerator'

/**
 * Base class for all enemies.
 *
 * ============================================================================
 * PERFORMANCE OPTIMIZATION - SPRITE RENDERING
 * ============================================================================
 *
 * This class uses GPU-accelerated sprites instead of CPU-intensive graphics
 * drawing. This provides 50-100x better performance.
 *
 * HOW IT WORKS:
 * - Textures are pre-generated once at game startup (TextureGenerator)
 * - Each enemy uses a sprite that references the cached texture
 * - Color changes use sprite.setTint() (instant, no redraw)
 * - Size changes use sprite.setScale() (instant, no redraw)
 * - Rotation is handled automatically by container
 *
 * CUSTOMIZATION:
 * - Most enemies automatically use sprites (no code changes needed)
 * - For special effects (trails, custom shapes), set:
 *   ```typescript
 *   usesCustomRendering = true
 *   ```
 *   Then override Draw() and it will work like before with Graphics
 *
 * ============================================================================
 * HOW TO CREATE A NEW ENEMY
 * ============================================================================
 *
 * To create a new enemy type, extend this class and override:
 * - SetDefaults() - Define stats like health, speed, damage, sides, color
 * - AI() - Define behavior each frame (optional, default moves toward player)
 * - PreAI() - Run before AI, return false to skip AI (optional)
 * - OnHit() - What happens when taking damage (optional)
 * - OnDeath() - What happens when killed (optional)
 *
 * DYNAMIC COLOR CHANGES:
 * ```typescript
 * this.color = 0xff0000 // Updates sprite tint automatically
 * ```
 *
 * CUSTOM RENDERING (opt-in for special effects):
 * ```typescript
 * usesCustomRendering = true // Forces Graphics rendering
 * Draw(): void {
 *   this.graphics.clear()
 *   // Your custom drawing code
 * }
 * ```
 */
export abstract class Enemy {
  // ============ STATS (set these in SetDefaults) ============
  health: number = 50
  maxHealth: number = 50
  speed: number = 60
  damage: number = 10
  sides: number = 4
  radius: number = 20
  color: number = 0xff0000
  scoreChance: number = 0.5  // Chance to drop score on death (0 to 1)
  speedCap: number = 2  // Maximum speed multiplier (default 2x)
  scale: number = 1.0  // Visual scale multiplier (0.8 = 80%, 1.0 = 100%, 1.2 = 120%)
  hitboxSize: number = 1.0  // Collision radius multiplier relative to visual radius (0.8 = 80%, 1.0 = 100%)
  knockbackResistance: number = 0  // Knockback resistance (0 = none, 1 = immune)
  barWidth: number = 20  // Health bar width
  barHeight: number = 4  // Health bar height

  // ============ RUNTIME STATE ============
  protected scene!: Phaser.Scene
  protected container!: Phaser.GameObjects.Container

  /**
   * Main sprite for rendering.
   * ALL enemies use sprites (no Graphics).
   * Override Draw() to customize rendering (multiple sprites, effects, etc.)
   */
  protected sprite!: Phaser.GameObjects.Sprite

  protected healthBar!: Phaser.GameObjects.Graphics
  protected healthText!: Phaser.GameObjects.Text
  protected body!: Phaser.Physics.Arcade.Body

  /** Tracks the current color to detect changes for sprite tinting */
  private _previousColor: number = 0

  x: number = 0
  y: number = 0
  

  /** old position and velocity history arrays */
  doOldPositionTracking: boolean = false
  doOldVelocityTracking: boolean = false
  doOldRotationTracking: boolean = false  // NEW: Track rotation for trails

  oldPositionX: number[] = []
  oldPositionY: number[] = []
  oldVelocityX: number[] = []
  oldVelocityY: number[] = []
  oldRotations: number[] = []  // NEW: Store rotation history

  /* old position tracking: count and interval */
  oldTrackingCounter: number = 10 // number of positions to store
  oldTrackingInterval: number = 500 // milliseconds between recordings
  oldTrackingLastTime: number = 0
  velocityX: number = 0
  velocityY: number = 0
  rotation: number = 0

  private _isDestroyed: boolean = false
  private _id: number = 0
  isBoss: boolean = false
  private knockbackEndTime: number = 0 // When knockback effect expires
  lastHitPlayerTime: number = 0 // When this enemy last hit the player (for per-enemy damage cooldown)

  // ============ LIFECYCLE HOOKS (override these) ============

  /**
   * Set the enemy's base stats here.
   *
   * Example:
   * ```
   * SetDefaults() {
   *   this.health = 100
   *   this.speed = 80
   *   this.sides = 5
   *   this.color = 0xff00ff
   * }
   * ```
   */
  abstract SetDefaults(): void

  /**
   * ========================================================================
   * TMODLOADER-STYLE RENDERING HOOKS
   * ========================================================================
   *
   * PreDraw(): Called before Draw(). Return false to skip default rendering.
   * Draw(): Renders the main sprite. Override to customize.
   * PostDraw(): Called after Draw(). Use for trails, effects, outlines.
   */

  /**
   * Called before Draw().
   * Return FALSE to skip the default Draw() call.
   * Use for completely custom rendering or conditional rendering.
   *
   * @example
   * PreDraw(): boolean {
   *   if (this.isInvisible) return false // Don't draw
   *   return true // Continue with Draw()
   * }
   */
  PreDraw(): boolean {
    return true // Always draw by default
  }

  /**
   * Renders the enemy's sprite.
   * Default: Draws sprite with texture based on this.sides, tinted to this.color.
   *
   * Override to customize rendering (multiple sprites, special textures, etc.)
   *
   * @example
   * Draw(): void {
   *   // Draw outline sprite
   *   const outlineKey = TextureGenerator.getPolygonTextureKey(this.sides, false)
   *   const outlineSprite = this.scene.add.sprite(0, 0, `${outlineKey}_outline`)
   *   outlineSprite.setTint(0xffffff)
   *   this.container.add(outlineSprite)
   *
   *   // Call default to draw main sprite
   *   super.Draw()
   * }
   */
  Draw(): void {
    // Default implementation: Update sprite tint if changed
    // Sprite is already created in _spawn, just update it here
    if (this.color !== this._previousColor) {
      this.sprite.setTint(this.color)
      this._previousColor = this.color
    }

    // Do NOT add outline sprite here - only Super variants get the extra outline
  }

  /**
   * Called after Draw().
   * Use for rendering effects on top: trails, particles, outlines, etc.
   *
   * @example
   * PostDraw(): void {
   *   // Render trail sprites at old positions
   *   TrailRenderer.renderTrail(this.scene, {
   *     positions: this.oldPositionX.map((x, i) => ({ x, y: this.oldPositionY[i] })),
   *     textureKey: 'circle_5',
   *     tint: this.color,
   *     maxAlpha: 0.3
   *   })
   * }
   */
  PostDraw(): void {
    // Default: no post-draw effects
  }

  /**
   * Override this to use a custom outline texture (e.g., for Diamond enemy).
   * Default uses polygon outline based on sides.
   */
  protected getOutlineTextureKey(): string {
    const textureKey = TextureGenerator.getPolygonTextureKey(this.sides, false)
    return `${textureKey}_outline`
  }

  /**
   * Draw the health bar below the enemy.
   */
  private drawHealthBar(_barWidth?: number, _barHeight?: number): void {
    if (this.healthBar) {
      this.healthBar.clear()

      const barWidth = _barWidth ?? this.barWidth
      const barHeight = _barHeight ?? this.barHeight
      
      // Position bar below enemy in world space (not relative to container)
      const barX = this.x - barWidth / 2
      const barY = this.y + this.radius + 10

      // Background (opacity)
      this.healthBar.fillStyle(0xff0000, 0)
      this.healthBar.fillRect(barX, barY, barWidth, barHeight)

      // Health (red)
      const healthPercent = Math.max(0, this.health / this.maxHealth)
      this.healthBar.fillStyle(0xff0000, 1)
      this.healthBar.fillRect(barX, barY, barWidth * healthPercent, barHeight)

      // Border
      this.healthBar.lineStyle(1, 0xffffff, 1)
      this.healthBar.strokeRect(barX, barY, barWidth, barHeight)
    }

    // Update health text position
    if (this.healthText) {
      this.healthText.setPosition(this.x - 30, this.y + this.radius + 10)
      this.healthText.setText(`${Math.ceil(this.health)}/${Math.ceil(this.maxHealth)}`)
    }
  }

  /**
   * Called before AI each frame.
   * Return false to skip the AI() call this frame.
   */
  PreAI(): boolean {
    return true
  }

  /**
   * Called every frame. Define movement/behavior here.
   * Default moves towards player.
   */
  AI(_playerX: number, _playerY: number): void {
    // Default: move towards player (set in update)
  }

  /**
   * Called when this enemy takes damage.
   * Return false to prevent the damage.
   */
  OnHit(_damage: number, _source: any): boolean {
    return true
  }

  /**
   * Called when this enemy dies.
   * Use for death effects, drops, splitting, etc.
   */
  OnDeath(): void {}

  // ============ PUBLIC METHODS ============

  /**
   * Move towards a target position with smooth interpolation.
   */
  moveTowards(targetX: number, targetY: number): void {
    const angle = Phaser.Math.Angle.Between(this.x, this.y, targetX, targetY)
    const targetVelX = Math.cos(angle) * this.speed
    const targetVelY = Math.sin(angle) * this.speed

    // Lerp velocity for smooth movement (0.15 = smoothing factor)
    const smoothing = 0.15
    this.velocityX = Phaser.Math.Linear(this.velocityX, targetVelX, smoothing)
    this.velocityY = Phaser.Math.Linear(this.velocityY, targetVelY, smoothing)

    // Lerp rotation for smooth turning
    this.rotation = Phaser.Math.Angle.RotateTo(this.rotation, angle + Math.PI / 2, 0.1)
  }

  /**
   * Apply knockback to this enemy.
   */
  applyKnockback(velocityX: number, velocityY: number): void {
    // Skip knockback entirely if immune
    if (this.knockbackResistance >= 1) {
      return
    }

    // Apply knockback resistance
    const knockbackMultiplier = 1 - this.knockbackResistance
    this.velocityX = velocityX * knockbackMultiplier
    this.velocityY = velocityY * knockbackMultiplier
    // Prevent AI from immediately overwriting knockback velocity for 100ms
    this.knockbackEndTime = this.scene.time.now + 100
  }

  /*this.velocityX = velocityX * knockbackMultiplier
    this.velocityY = velocityY * knockbackMultiplier
    // Prevent AI from immediately overwriting knockback velocity for 100ms
    this.knockbackEndTime = this.scene.time.now + 100
   */
  takeDamage(amount: number, source?: any): boolean {
    if (!this.OnHit(amount, source)) {
      return false
    }

    this.health -= amount
    this.drawHealthBar()

    // Flash white using sprite tint
    const originalColor = this.color
    this.sprite.setTint(0xffffff)
    this.scene.time.delayedCall(50, () => {
      if (!this._isDestroyed) {
        this.sprite.setTint(originalColor)
        this._previousColor = originalColor // Update tracking
      }
    })

    if (this.health <= 0) {
      this._die()
      return true
    }
    return false
  }

  // ============ INTERNAL METHODS ============

  /** @internal */
  _spawn(scene: Phaser.Scene, x: number, y: number, id: number): Phaser.GameObjects.Container {
    this.scene = scene
    this.x = x
    this.y = y
    this._id = id
    this.maxHealth = this.health  // Set maxHealth AFTER all stat modifications
    this.oldTrackingLastTime = scene.time.now
    this._previousColor = this.color // Track initial color for tint updates

    // Initialize old position/velocity/rotation arrays
    if (this.doOldPositionTracking)
    {
      this.oldPositionX = new Array(this.oldTrackingCounter).fill(x)
      this.oldPositionY = new Array(this.oldTrackingCounter).fill(y)
    }
    if (this.doOldVelocityTracking)
    {
      this.oldVelocityX = new Array(this.oldTrackingCounter).fill(0)
      this.oldVelocityY = new Array(this.oldTrackingCounter).fill(0)
    }
    if (this.doOldRotationTracking)
    {
      this.oldRotations = new Array(this.oldTrackingCounter).fill(0)
    }

    this.container = scene.add.container(x, y)
    this.container.setData('isEnemy', true)
    this.container.setData('enemyInstance', this)

    // ============ CREATE SPRITE (Always) ============
    // All enemies use sprites - generate texture on-demand
    const textureKey = TextureGenerator.getOrCreatePolygon(scene, {
      sides: this.sides,
      radius: this.radius,
      fillColor: 0xd9d9d9,  // Light gray for visible stroke when tinted
      fillAlpha: 1.0,
      strokeWidth: 3,
      strokeColor: 0xffffff,
      strokeAlpha: 1.0
    })
    this.sprite = scene.add.sprite(0, 0, textureKey)
    this.sprite.setTint(this.color) // Apply color via tint
    this.sprite.setScale(TextureGenerator.getDisplayScale())  // Scale down high-res texture

    this.container.add(this.sprite)

    // Create health bar if enabled in dev settings (added to scene, not container, so it doesn't rotate)
    if (DEV_SETTINGS.showEnemyHealthBar) {
      this.healthBar = scene.add.graphics()
      this.healthBar.setDepth(this.container.depth + 1)  // Render above the enemy
    }

    // Create health text if enabled in dev settings (added to scene, not container, so it doesn't rotate)
    if (DEV_SETTINGS.showEnemyHealthNumber) {
      this.healthText = scene.add.text(this.x - 20, this.y + this.radius + 10, `${Math.ceil(this.health)}/${Math.ceil(this.maxHealth)}`, {
        fontSize: '12px',
        color: '#ffffff',
        align: 'center'
      })
      this.healthText.setOrigin(0.5, 0.5)
      this.healthText.setDepth(this.container.depth + 1)  // Render above the enemy
    }

    scene.add.existing(this.container)
    scene.physics.add.existing(this.container)

    // Apply scale to container
    this.container.setScale(this.scale)

    this.body = this.container.body as Phaser.Physics.Arcade.Body
    const hitboxRadius = this.radius * this.scale * this.hitboxSize
    this.body.setCircle(hitboxRadius)
    this.body.setOffset(-hitboxRadius, -hitboxRadius)

    // Initial draw (calls PreDraw/Draw/PostDraw)
    this._renderFrame()
    this.drawHealthBar()

    return this.container
  }

  /** @internal */
  _update(playerX: number, playerY: number): void {
    if (this._isDestroyed) return

    this.x = this.container.x
    this.y = this.container.y

    if ((this.doOldPositionTracking || this.doOldVelocityTracking || this.doOldRotationTracking) && this.scene.time.now - this.oldTrackingLastTime >= this.oldTrackingInterval)
    {
      this.oldTrackingLastTime = this.scene.time.now

      if (this.doOldPositionTracking)
      {
        this.oldPositionX.shift()
        this.oldPositionX.push(this.x)

        this.oldPositionY.shift()
        this.oldPositionY.push(this.y)
      }

      if (this.doOldVelocityTracking)
      {
        this.oldVelocityX.shift()
        this.oldVelocityX.push(this.velocityX)

        this.oldVelocityY.shift()
        this.oldVelocityY.push(this.velocityY)
      }

      if (this.doOldRotationTracking)
      {
        //  this.oldRotations.shift()
        this.oldRotations.push(this.rotation)
      }
    }

    // Only run AI if not in knockback state
    if (this.PreAI() && this.scene.time.now >= this.knockbackEndTime) {
      // Default movement towards player
      this.moveTowards(playerX, playerY)

      // Custom AI
      this.AI(playerX, playerY)
    }

    this.body.setVelocity(this.velocityX, this.velocityY)
    this.container.rotation = this.rotation

    // ============ RENDER FRAME (PreDraw/Draw/PostDraw) ============
    this._renderFrame()

    // Update health bar position (kept upright in world space)
    this.drawHealthBar()
  }

  /**
   * @internal
   * Calls PreDraw/Draw/PostDraw hooks in sequence.
   * This is the tModLoader-style rendering pipeline.
   */
  private _renderFrame(): void {
    // PreDraw: Setup/conditional rendering
    const shouldDraw = this.PreDraw()
    if (!shouldDraw) return

    // Draw: Main sprite rendering
    this.Draw()

    // PostDraw: Effects on top (trails, particles, etc.)
    this.PostDraw()
  }


  private _die(): void {
    if (this._isDestroyed) return
    this._isDestroyed = true

    this.OnDeath()

    // Destroy health bar and text
    if (this.healthBar) this.healthBar.destroy()
    if (this.healthText) this.healthText.destroy()

    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      scale: 1.5,
      duration: 200,
      onComplete: () => {
        this.container?.destroy()
      }
    })
  }

  /** @internal */
  _destroy(): void {
    if (this._isDestroyed) return
    this._isDestroyed = true
    this.container?.destroy()
  }

  get isDestroyed(): boolean {
    return this._isDestroyed
  }

  get id(): number {
    return this._id
  }

  getContainer(): Phaser.GameObjects.Container {
    return this.container
  }
}
