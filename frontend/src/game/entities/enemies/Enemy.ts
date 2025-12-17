import Phaser from 'phaser'
import { DEV_SETTINGS } from '../../core/GameConfig'

/**
 * Base class for all enemies.
 *
 * To create a new enemy type, extend this class and override:
 * - SetDefaults() - Define stats like health, speed, damage, sides
 * - Draw() - Define how the enemy looks (optional, default draws polygon)
 * - AI() - Define behavior each frame
 * - PreAI() - Run before AI, return false to skip AI
 * - OnHit() - What happens when taking damage
 * - OnDeath() - What happens when killed
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

  // ============ RUNTIME STATE ============
  protected scene!: Phaser.Scene
  protected container!: Phaser.GameObjects.Container
  protected graphics!: Phaser.GameObjects.Graphics
  protected healthBar!: Phaser.GameObjects.Graphics
  protected healthText!: Phaser.GameObjects.Text
  protected body!: Phaser.Physics.Arcade.Body

  x: number = 0
  y: number = 0
  

  /** old position and velocity history arrays */
  doOldPositionTracking: boolean = false
  doOldVelocityTracking: boolean = false

  oldPositionX: number[] = []
  oldPositionY: number[] = []
  oldVelocityX: number[] = []
  oldVelocityY: number[] = []

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
   * Draw the enemy's visuals.
   * Default draws a polygon based on this.sides.
   */
  Draw(): void {
    this.graphics.clear()

    const vertices: Phaser.Math.Vector2[] = []
    const angleStep = (Math.PI * 2) / this.sides

    for (let i = 0; i < this.sides; i++) {
      const angle = angleStep * i - Math.PI / 2
      vertices.push(new Phaser.Math.Vector2(
        Math.cos(angle) * this.radius,
        Math.sin(angle) * this.radius
      ))
    }

    this.graphics.fillStyle(this.color, 1)
    this.graphics.lineStyle(2, 0xffffff, 0.5)

    this.graphics.beginPath()
    this.graphics.moveTo(vertices[0].x, vertices[0].y)
    for (let i = 1; i < vertices.length; i++) {
      this.graphics.lineTo(vertices[i].x, vertices[i].y)
    }
    this.graphics.closePath()
    this.graphics.fillPath()
    this.graphics.strokePath()
  }

  /**
   * Draw the health bar above the enemy.
   */
  private drawHealthBar(): void {
    if (this.healthBar) {
      this.healthBar.clear()

      const barWidth = 20
      const barHeight = 4
      
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

  /**
   * Deal damage to this enemy.
   * Returns true if the enemy died.
   */
  takeDamage(amount: number, source?: any): boolean {
    if (!this.OnHit(amount, source)) {
      return false
    }

    this.health -= amount
    this.drawHealthBar()

    // Flash white
    this._drawWithColor(0xffffff)
    this.scene.time.delayedCall(50, () => {
      if (!this._isDestroyed) this.Draw()
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

    // Initialize old position/velocity arrays
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

    this.container = scene.add.container(x, y)
    this.container.setData('isEnemy', true)
    this.container.setData('enemyInstance', this)

    this.graphics = scene.add.graphics()
    this.container.add(this.graphics)

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

    this.Draw()
    this.drawHealthBar()

    return this.container
  }

  /** @internal */
  _update(playerX: number, playerY: number): void {
    if (this._isDestroyed) return

    this.x = this.container.x
    this.y = this.container.y

    if ((this.doOldPositionTracking || this.doOldVelocityTracking) && this.scene.time.now - this.oldTrackingLastTime >= this.oldTrackingInterval)
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

    // Redraw every frame to update trails and animations
    this.Draw()

    // Update health bar position (kept upright in world space)
    this.drawHealthBar()
  }

  private _drawWithColor(color: number): void {
    this.graphics.clear()

    const vertices: Phaser.Math.Vector2[] = []
    const angleStep = (Math.PI * 2) / this.sides

    for (let i = 0; i < this.sides; i++) {
      const angle = angleStep * i - Math.PI / 2
      vertices.push(new Phaser.Math.Vector2(
        Math.cos(angle) * this.radius,
        Math.sin(angle) * this.radius
      ))
    }

    this.graphics.fillStyle(color, 1)
    this.graphics.lineStyle(2, 0xffffff, 0.5)

    this.graphics.beginPath()
    this.graphics.moveTo(vertices[0].x, vertices[0].y)
    for (let i = 1; i < vertices.length; i++) {
      this.graphics.lineTo(vertices[i].x, vertices[i].y)
    }
    this.graphics.closePath()
    this.graphics.fillPath()
    this.graphics.strokePath()
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
