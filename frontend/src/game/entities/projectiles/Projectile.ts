import Phaser from 'phaser'
// import { Player } from '../Player'
import { GameManager } from '../../core/GameManager'

/**
 * Base class for all projectiles.
 *
 * To create a new projectile type, extend this class and override:
 * - SetDefaults() - Define stats like damage, speed, size, pierce
 * - Draw() - Define how the projectile looks
 * - AI() - Define behavior each frame (optional)
 * - OnHitNPC() - What happens when hitting an enemy (optional)
 * - OnKill() - What happens when projectile is destroyed (optional)
 */
export abstract class Projectile {
  id: number = 0
  // ============================================================
  // STATS - Set these in your SetDefaults() method
  // ============================================================

  /** How much damage this projectile deals when it hits an enemy */
  damage: number = 10

  /** Multiplier applied to damage at collision time (useful for variants that deal reduced damage) */
  damageMultiplier: number = 1

  /** How fast the projectile travels (pixels per second) */
  speed: number = 400

  /** The radius of the projectile in pixels (affects hitbox and visuals) */
  size: number = 5

  /** How many UNIQUE enemies this projectile can pass through before being destroyed.
   *  0 = destroys on first hit, 1 = passes through 1 unique enemy, etc.
   *  Note: Projectiles can hit the same enemy multiple times if hitEnemyCooldown allows it. */
  pierce: number = 0

  /** The color of the projectile (hex value, e.g. 0xff0000 for red) */
  color: number = 0x00ffff

  /** How transparent the glow effect is (0 = invisible, 1 = solid) */
  glowAlpha: number = 0.3

  /** How much larger the glow is compared to the projectile (1.5 = 50% larger) */
  glowScale: number = 1.5

  /** How long the projectile lives before auto-destroying (milliseconds) */
  timeLeft: number = 60000

  /** Cooldown between hitting the same enemy again (milliseconds).
   *  Allows homing/piercing projectiles to circle back and hit the same enemy repeatedly.
   *  Set to 0 to disable (projectile can only hit each enemy once).
   *  Default 500ms balances DPS while preventing instant re-hits. */
  hitEnemyCooldown: number = 500

  /** Whether this projectile can cut through terrain/obstacles.
   *  When true, hitting terrain counts as a pierce hit but doesn't destroy the projectile.
   *  When false (default), the projectile ignores terrain collision. */
  canCutTiles: boolean = false

  // ============================================================
  // POSITION & MOVEMENT - Updated automatically each frame
  // You can read these in AI() or modify velocity to change direction
  // ============================================================

  /** Current X position on screen (pixels from left edge) */
  positionX: number = 0

  /** Current Y position on screen (pixels from top edge) */
  positionY: number = 0

  /** Current horizontal speed (pixels per second, positive = right) */
  velocityX: number = 0

  /** Current vertical speed (pixels per second, positive = down) */
  velocityY: number = 0

  /** Current rotation angle in radians (0 = pointing right) */
  rotation: number = 0

  /** Who fired this projectile: 'player' or 'enemy' */
  owner: 'player' | 'enemy' = 'player'

  /** ID of the entity that fired this (player or enemy id) */
  ownerId: number = 0

  /** force of knockback applied on hit (negative speed) */
  // 25 is low
  // 50 is medium
  // 100 is high
  knockback: number = 0

  // ============================================================
  // INTERNAL - Don't modify these directly
  // ============================================================

  /** The Phaser scene this projectile belongs to. Use for spawning effects, timers, etc. */
  protected scene!: Phaser.Scene

  /** The container holding this projectile's graphics. Used internally for physics. */
  protected container!: Phaser.GameObjects.Container

  /** The graphics object for drawing. Use this in Draw() to create visuals. */
  protected graphics!: Phaser.GameObjects.Graphics

  /** The physics body. Used internally for movement and collision. */
  protected body!: Phaser.Physics.Arcade.Body

  /** How many enemies this projectile has already pierced through */
  currentPierceCount: number = 0

  /** Map of enemy IDs to timestamp of last hit (for cooldown-based re-hitting) */
  private enemyHitTimestamps: Map<number, number> = new Map()

  /** Whether this projectile has been destroyed */
  private destroyed: boolean = false

  /** When this projectile was spawned (for timeLeft tracking) */
  private spawnTime: number = 0

  // ============================================================
  // LIFECYCLE HOOKS - Override these in your projectile class
  // ============================================================

  /**
   * Set the projectile's base stats here. Called once when created.
   *
   * Example:
   * ```
   * SetDefaults() {
   *   this.damage = 25
   *   this.speed = 600
   *   this.pierce = 2
   *   this.color = 0xff0000
   *   this.timeLeft = 3000 // despawn after 3 seconds
   * }
   * ```
   */
  abstract SetDefaults(): void

  /**
   * Draw the projectile's visuals. Called once after spawning.
   * Use this.graphics to draw shapes. Default draws a circle with glow.
   *
   * Example:
   * ```
   * Draw() {
   *   // Draw a triangle instead of circle
   *   this.graphics.fillStyle(this.color, 1)
   *   this.graphics.fillTriangle(-5, 5, 5, 0, -5, -5)
   * }
   * ```
   */
  Draw(): void {
    // Main projectile body
    this.graphics.fillStyle(this.color, 1)
    this.graphics.fillCircle(0, 0, this.size)

    // Glow effect behind it
    this.graphics.fillStyle(this.color, this.glowAlpha)
    this.graphics.fillCircle(0, 0, this.size * this.glowScale)
  }

  /**
   * Called every frame. Use to create custom movement patterns.
   * Modify this.velocityX and this.velocityY to change direction.
   *
   * Example (homing projectile):
   * ```
   * AI() {
   *   const nearestEnemy = this.findNearestEnemy()
   *   if (nearestEnemy) {
   *     const angle = Phaser.Math.Angle.Between(
   *       this.positionX, this.positionY,
   *       nearestEnemy.x, nearestEnemy.y
   *     )
   *     this.velocityX = Math.cos(angle) * this.speed
   *     this.velocityY = Math.sin(angle) * this.speed
   *   }
   * }
   * ```
   */
  AI(): void {
    // Default: no special behavior, travels in straight line
  }

  /**
   * Called when this projectile hits an enemy.
   * Return true to deal damage, false to ignore the hit.
   *
   * Example (lifesteal projectile):
   * ```
   * OnHitNPC(enemy) {
   *   // Heal player for 10% of damage dealt
   *   this.scene.events.emit('heal-player', this.damage * 0.1)
   *   return true
   * }
   * ```
   */
  OnHitNPC(_enemy: any): boolean {
    return true
  }

  /**
   * Called when projectile is destroyed (hit something, timed out, or left screen).
   * Use for death effects like explosions or particles.
   *
   * Example:
   * ```
   * OnKill() {
   *   // Create explosion effect
   *   const explosion = this.scene.add.circle(this.positionX, this.positionY, 30, 0xff0000, 0.5)
   *   this.scene.tweens.add({
   *     targets: explosion,
   *     alpha: 0,
   *     scale: 2,
   *     duration: 200,
   *     onComplete: () => explosion.destroy()
   *   })
   * }
   * ```
   */
  OnKill(): void {}

  // ============================================================
  // INTERNAL METHODS - Called by the game engine, don't override
  // ============================================================

  /** @internal Spawns the projectile at a position, aimed at a target */
  _spawn(scene: Phaser.Scene, startX: number, startY: number, targetX: number, targetY: number): Phaser.GameObjects.Container {
    this.scene = scene
    this.positionX = startX
    this.positionY = startY
    this.spawnTime = scene.time.now

    // Create the visual container
    this.container = scene.add.container(startX, startY)
    this.graphics = scene.add.graphics()
    this.container.add(this.graphics)

    // Add to scene and enable physics
    scene.add.existing(this.container)
    scene.physics.add.existing(this.container)

    // Set up collision hitbox
    this.body = this.container.body as Phaser.Physics.Arcade.Body
    this.body.setCircle(this.size)
    this.body.setOffset(-this.size, -this.size)

    // Calculate direction towards target and set velocity
    const angle = Phaser.Math.Angle.Between(startX, startY, targetX, targetY)
    this.velocityX = Math.cos(angle) * this.speed
    this.velocityY = Math.sin(angle) * this.speed
    this.rotation = angle

    this.body.setVelocity(this.velocityX, this.velocityY)
    this.container.rotation = angle

    // Draw the projectile
    this.Draw()

    return this.container
  }

  /** @internal Called every frame to update position and run AI */
  _update(): void {
    if (this.destroyed) return

    // Sync position from physics engine
    this.positionX = this.container.x
    this.positionY = this.container.y

    // Check if lifetime expired
    if (this.scene.time.now - this.spawnTime > this.timeLeft) {
      this._destroy()
      return
    }

    // Run custom AI behavior
    this.AI()

    // Apply any velocity changes from AI
    this.body.setVelocity(this.velocityX, this.velocityY)
  }

  /** @internal Checks if this projectile can hit a specific enemy (cooldown has elapsed) */
  _canHitEnemy(enemyId: number): boolean {
    const lastHitTime = this.enemyHitTimestamps.get(enemyId)
    if (!lastHitTime) return true // Never hit this enemy before

    // Check if cooldown has elapsed since last hit
    const timeSinceLastHit = this.scene.time.now - lastHitTime
    return timeSinceLastHit >= this.hitEnemyCooldown
  }

  /** @internal Records a hit on an enemy, returns false if projectile should be destroyed */
  _recordHit(enemyId: number, enemy: any): boolean {
    if (!this._canHitEnemy(enemyId)) return true

    // Track when we hit this enemy (before calling OnHitNPC)
    const isFirstHit = !this.enemyHitTimestamps.has(enemyId)
    this.enemyHitTimestamps.set(enemyId, this.scene.time.now)

    const shouldDamage = this.OnHitNPC(enemy)

    if (shouldDamage || isFirstHit) {
      // Only increment pierce count on first hit of each unique enemy
      if (isFirstHit) {
        this.currentPierceCount++

        if (this.currentPierceCount > this.pierce) {
          this._destroy()
          return false
        }
      }
    }
    return true
  }

  /** @internal Checks if projectile has left the screen */
  _isOutOfBounds(screenWidth: number, screenHeight: number): boolean {
    const margin = 50
    return this.positionX < -margin ||
           this.positionX > screenWidth + margin ||
           this.positionY < -margin ||
           this.positionY > screenHeight + margin
  }

  /** @internal Destroys the projectile */
  _destroy(): void {
    if (this.destroyed) return
    this.destroyed = true

    this.OnKill()
    this.container?.destroy()

    // Unregister from GameManager
    GameManager.removeProjectile(this.id)
  }

  /** Whether this projectile has been destroyed */
  get isDestroyed(): boolean {
    return this.destroyed
  }

  /** @internal Gets the Phaser container for collision detection */
  getContainer(): Phaser.GameObjects.Container {
    return this.container
  }

  // ============================================================
  // HELPER METHODS - Use these in your AI() or other hooks
  // ============================================================

  /** Gets the distance to a point */
  distanceTo(targetX: number, targetY: number): number {
    return Phaser.Math.Distance.Between(this.positionX, this.positionY, targetX, targetY)
  }

  /** Gets the angle to a point (in radians) */
  angleTo(targetX: number, targetY: number): number {
    return Phaser.Math.Angle.Between(this.positionX, this.positionY, targetX, targetY)
  }

  /** Sets velocity to move towards a target at current speed */
  moveTowards(targetX: number, targetY: number): void {
    const angle = this.angleTo(targetX, targetY)
    this.velocityX = Math.cos(angle) * this.speed
    this.velocityY = Math.sin(angle) * this.speed
    this.rotation = angle
    this.container.rotation = angle
  }
}
