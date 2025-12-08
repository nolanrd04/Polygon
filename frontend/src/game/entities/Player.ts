import Phaser from 'phaser'
import { GameManager } from '../core/GameManager'
import { COLORS } from '../core/GameConfig'
import { Projectile } from './projectiles/Projectile'
import { Bullet, HeavyBullet, HomingBullet, ExplosiveBullet } from './projectiles/player_projectiles/Bullet'
import { Laser } from './projectiles/player_projectiles/Laser'
import { Zapper } from './projectiles/player_projectiles/Zapper'
import { Flame } from './projectiles/player_projectiles/Flame'
import { Spinner } from './projectiles/player_projectiles/Spinner'
import { AttackType } from '../data/attackTypes'
import { UpgradeSystem, UpgradeEffectSystem, UpgradeModifierSystem } from '../systems/upgrades'

/**
 * The player character - a polygon that can move and shoot projectiles.
 */
export class Player extends Phaser.GameObjects.Container {
  // ============================================================
  // STATS - Player attributes
  // ============================================================

  /** Number of sides on the player's polygon (3 = triangle, 4 = square, etc.) */
  sides: number = 3

  /** Size of the player in pixels (radius of the polygon) */
  radius: number = 25

  /** The type of projectile this player shoots */
  attackType: AttackType

  // ============================================================
  // POSITION & MOVEMENT - Updated automatically each frame
  // ============================================================

  /** Current X position on screen (pixels from left edge) */
  positionX: number = 0

  /** Current Y position on screen (pixels from top edge) */
  positionY: number = 0

  // ============================================================
  // INTERNAL - Used by the game engine
  // ============================================================

  /** The Phaser physics body for collision and movement */
  declare public body: Phaser.Physics.Arcade.Body

  /** The graphics object for drawing the player polygon */
  private graphics: Phaser.GameObjects.Graphics

  /** All active projectiles fired by this player */
  private projectiles: Projectile[] = []

  /** Phaser group containing all projectile containers (for collision detection) */
  private projectileGroup: Phaser.GameObjects.Group

  /** Timestamp of the last shot (for cooldown tracking) */
  private lastFireTime: number = 0

  /** Reference to active spinner projectile (only one can exist at a time) */
  private activeSpinner: Spinner | null = null

  /** Reference to active flame projectile (continuous effect) */
  private activeFlame: Flame | null = null

  /** Shield state */
  private shielded: boolean = false
  private shieldGraphics: Phaser.GameObjects.Graphics | null = null

  // ============================================================
  // CONSTRUCTOR
  // ============================================================

  constructor(scene: Phaser.Scene, x: number, y: number, attackType: AttackType = 'bullet') {
    super(scene, x, y)

    this.attackType = attackType
    this.positionX = x
    this.positionY = y

    this.graphics = scene.add.graphics()
    this.add(this.graphics)

    this.projectileGroup = scene.add.group()

    scene.add.existing(this)
    scene.physics.add.existing(this)

    this.body = this.body as Phaser.Physics.Arcade.Body
    this.body.setCircle(this.radius)
    this.body.setOffset(-this.radius, -this.radius)
    this.body.setCollideWorldBounds(true)

    this.Draw()
  }

  // ============================================================
  // DRAWING - How the player looks
  // ============================================================

  /**
   * Draw the player's polygon shape.
   * Called automatically when the player is created or updated.
   */
  Draw(): void {
    this.graphics.clear()

    const stats = GameManager.getPlayerStats()
    this.sides = stats.polygonSides

    const vertices: Phaser.Math.Vector2[] = []
    const angleStep = (Math.PI * 2) / this.sides

    for (let i = 0; i < this.sides; i++) {
      const angle = angleStep * i - Math.PI / 2
      vertices.push(new Phaser.Math.Vector2(
        Math.cos(angle) * this.radius,
        Math.sin(angle) * this.radius
      ))
    }

    // Main polygon body
    this.graphics.fillStyle(COLORS.player, 1)
    this.graphics.lineStyle(3, COLORS.playerHead, 1)

    this.graphics.beginPath()
    this.graphics.moveTo(vertices[0].x, vertices[0].y)
    for (let i = 1; i < vertices.length; i++) {
      this.graphics.lineTo(vertices[i].x, vertices[i].y)
    }
    this.graphics.closePath()
    this.graphics.fillPath()
    this.graphics.strokePath()

    // "Head" indicator (front vertex)
    this.graphics.fillStyle(COLORS.playerHead, 1)
    this.graphics.fillCircle(vertices[0].x, vertices[0].y, 6)
  }

  /**
   * Draw the player with a temporary color (used for damage flash).
   */
  private DrawWithColor(color: number): void {
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
    this.graphics.lineStyle(3, 0xffffff, 1)

    this.graphics.beginPath()
    this.graphics.moveTo(vertices[0].x, vertices[0].y)
    for (let i = 1; i < vertices.length; i++) {
      this.graphics.lineTo(vertices[i].x, vertices[i].y)
    }
    this.graphics.closePath()
    this.graphics.fillPath()
    this.graphics.strokePath()

    this.graphics.fillStyle(0xffffff, 1)
    this.graphics.fillCircle(vertices[0].x, vertices[0].y, 6)
  }

  // ============================================================
  // MOVEMENT - How the player moves
  // ============================================================

  /**
   * Move the player in a direction.
   * @param velocityX Horizontal direction (-1 = left, 0 = none, 1 = right)
   * @param velocityY Vertical direction (-1 = up, 0 = none, 1 = down)
   */
  move(velocityX: number, velocityY: number): void {
    const stats = GameManager.getPlayerStats()
    const speed = stats.speed

    // Normalize diagonal movement so it's not faster
    if (velocityX !== 0 && velocityY !== 0) {
      velocityX *= 0.707
      velocityY *= 0.707
    }

    this.body.setVelocity(velocityX * speed, velocityY * speed)
  }

  /**
   * Rotate the player to face a target position (usually the mouse cursor).
   * @param targetX X position to face
   * @param targetY Y position to face
   */
  rotateTowards(targetX: number, targetY: number): void {
    const angle = Phaser.Math.Angle.Between(this.x, this.y, targetX, targetY)
    this.rotation = angle + Math.PI / 2
  }

  // ============================================================
  // SHOOTING - How the player attacks
  // ============================================================

  /**
   * Get the cooldown time between shots for the current attack type.
   * @returns Cooldown in milliseconds
   */
  private getCooldown(): number {
    switch (this.attackType) {
      case 'bullet': return 200
      case 'laser': return 300
      case 'zapper': return 400
      case 'flamer': return 50 // Very fast for continuous effect
      case 'spinner': return 1000
      default: return 200
    }
  }

  /**
   * Attempt to shoot a projectile towards a target.
   * Respects cooldown - won't fire if cooldown hasn't elapsed.
   * @param targetX X position to shoot towards
   * @param targetY Y position to shoot towards
   */
  shoot(targetX: number, targetY: number): void {
    const now = this.scene.time.now
    if (now - this.lastFireTime < this.getCooldown()) return

    this.lastFireTime = now

    // Calculate all polygon vertices with their facing angles
    const vertices: { x: number; y: number; angle: number }[] = []
    const angleStep = (Math.PI * 2) / this.sides

    for (let i = 0; i < this.sides; i++) {
      const angle = angleStep * i + this.rotation - Math.PI / 2
      vertices.push({
        x: this.x + Math.cos(angle) * this.radius,
        y: this.y + Math.sin(angle) * this.radius,
        angle: angle // The direction this corner is facing
      })
    }

    // Check for multishot effect
    const multishotCount = 1 + (UpgradeEffectSystem.getEffectValue('multishot') || 0)

    // Spawn projectiles from each vertex
    for (const vertex of vertices) {
      for (let i = 0; i < multishotCount; i++) {
        // Calculate spread angle for multishot
        const spreadAngle = multishotCount > 1 ? ((i - (multishotCount - 1) / 2) * 0.3) : 0

        // Shoot in the direction the corner is facing (not towards mouse)
        const shootAngle = vertex.angle + spreadAngle
        const adjustedTargetX = vertex.x + Math.cos(shootAngle) * 100
        const adjustedTargetY = vertex.y + Math.sin(shootAngle) * 100

        this.spawnProjectile(vertex.x, vertex.y, adjustedTargetX, adjustedTargetY)
      }
    }
  }

  /**
   * Spawn a single projectile with upgrade modifiers applied.
   */
  private spawnProjectile(startX: number, startY: number, targetX: number, targetY: number): void {
    let projectile: Projectile

    // Determine projectile class based on attack type and active variant
    switch (this.attackType) {
      case 'bullet':
        projectile = this.createBulletVariant()
        break

      case 'laser':
        projectile = new Laser()
        break

      case 'zapper':
        projectile = new Zapper()
        break

      case 'flamer':
        // Flamer is continuous - reuse existing or create new
        if (this.activeFlame && !this.activeFlame.isDestroyed) {
          this.activeFlame.getContainer().x = startX
          this.activeFlame.getContainer().y = startY
          return
        }
        projectile = new Flame()
        this.activeFlame = projectile as Flame
        break

      case 'spinner':
        // Spinner is a one-shot AOE - only one can exist at a time
        if (this.activeSpinner && !this.activeSpinner.isDestroyed) {
          return
        }
        projectile = new Spinner()
        projectile.pierce = this.sides
        this.activeSpinner = projectile as Spinner
        break

      default:
        projectile = new Bullet()
    }

    // Set default stats
    projectile.SetDefaults()

    // Apply upgrade modifiers
    this.applyUpgradeModifiers(projectile)

    // Assign unique ID from GameManager
    projectile.id = GameManager.generateProjectileId()

    // Spawn the projectile
    const container = projectile._spawn(this.scene, startX, startY, targetX, targetY)

    // Register with GameManager for tracking
    GameManager.addProjectile(projectile)

    this.projectiles.push(projectile)
    this.projectileGroup.add(container)
    console.log('Projectile damage after modifiers:', projectile.damage)
  }

  /**
   * Create the appropriate bullet variant based on active upgrades.
   */
  private createBulletVariant(): Projectile {
    const variant = UpgradeSystem.getVariant('bullet')

    switch (variant) {
      case 'HomingBullet':
        return new HomingBullet()
      case 'ExplosiveBullet':
        return new ExplosiveBullet()
      case 'HeavyBullet':
        return new HeavyBullet()
      default:
        return new Bullet()
    }
  }

  /**
   * Apply all active upgrade modifiers to a projectile.
   */
  private applyUpgradeModifiers(projectile: Projectile): void {
    const target = this.attackType // 'bullet', 'laser', etc.

    // Apply modifiers to each numeric stat
    const stats = ['damage', 'speed', 'size', 'pierce', 'timeLeft'] as const

    for (const stat of stats) {
      if (stat in projectile && typeof (projectile as any)[stat] === 'number') {
        const baseValue = (projectile as any)[stat]
        
        // For damage, check both attack-specific and global "attack" modifiers
        let modifiedValue: number
        if (stat === 'damage') {
          // Apply attack-specific damage modifiers first
          modifiedValue = UpgradeModifierSystem.applyModifiers(target, stat, baseValue)
          // Then apply global attack damage modifiers
          modifiedValue = UpgradeModifierSystem.applyModifiers('attack', stat, modifiedValue)
        } else {
          // For other stats, just use attack-specific modifiers
          modifiedValue = UpgradeModifierSystem.applyModifiers(target, stat, baseValue)
        }
        
        ;(projectile as any)[stat] = modifiedValue
      }
    }
  }

  // ============================================================
  // DAMAGE - How the player takes damage
  // ============================================================

  /**
   * Deal damage to the player.
   * Triggers a visual flash and updates GameManager.
   * @param amount Amount of damage to deal
   */
  takeDamage(amount: number): void {
    // Check if shielded
    if (this.shielded) {
      return // No damage when shielded
    }

    // Apply damage reduction from effects (armor, etc.)
    const modifiedAmount = UpgradeEffectSystem.onPlayerDamage(amount)

    GameManager.takeDamage(modifiedAmount)

    // Flash red
    this.DrawWithColor(0xff0000)
    this.scene.time.delayedCall(100, () => {
      this.Draw()
    })
  }

  /**
   * Activate shield (E key ability).
   */
  activateShield(): void {
    if (this.shielded) return
    if (!UpgradeEffectSystem.hasAbility('shield')) return

    this.shielded = true

    // Create shield visual
    this.shieldGraphics = this.scene.add.graphics()
    this.shieldGraphics.lineStyle(3, 0x00ffff, 0.8)
    this.shieldGraphics.strokeCircle(0, 0, this.radius + 10)
    this.shieldGraphics.fillStyle(0x00ffff, 0.2)
    this.shieldGraphics.fillCircle(0, 0, this.radius + 10)
    this.add(this.shieldGraphics)

    // Deactivate after 3 seconds
    this.scene.time.delayedCall(3000, () => {
      this.deactivateShield()
    })
  }

  /**
   * Deactivate shield.
   */
  private deactivateShield(): void {
    this.shielded = false
    if (this.shieldGraphics) {
      this.shieldGraphics.destroy()
      this.shieldGraphics = null
    }
  }

  // ============================================================
  // UPDATE - Called every frame
  // ============================================================

  /**
   * Update the player and all projectiles.
   * Called automatically every frame by the scene.
   */
  update(): void {
    // Sync position
    this.positionX = this.x
    this.positionY = this.y

    // Update spinner to follow player position
    if (this.activeSpinner && !this.activeSpinner.isDestroyed) {
      this.activeSpinner.followPlayer(this.x, this.y)
    }

    // Update all projectiles and clean up destroyed ones
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i]

      if (proj.isDestroyed || proj._isOutOfBounds(1280, 720)) {
        if (!proj.isDestroyed) proj._destroy()
        this.projectiles.splice(i, 1)

        // Clear special projectile references
        if (proj === this.activeSpinner) this.activeSpinner = null
        if (proj === this.activeFlame) this.activeFlame = null
      } else {
        proj._update()
      }
    }
  }

  // ============================================================
  // GETTERS - Access player state
  // ============================================================

  /** Get all active projectiles fired by this player */
  getProjectiles(): Projectile[] {
    return this.projectiles
  }

  /** Get the Phaser group containing all projectile containers (for collision detection) */
  getProjectileGroup(): Phaser.GameObjects.Group {
    return this.projectileGroup
  }

  /** Get the current attack type */
  getAttackType(): AttackType {
    return this.attackType
  }

  /** Get the player's radius in pixels */
  getRadius(): number {
    return this.radius
  }

  /** Get the number of sides on the player's polygon */
  getSides(): number {
    return this.sides
  }

  /** Clear all projectiles (called at end of round) */
  clearProjectiles(): void {
    for (const proj of this.projectiles) {
      if (!proj.isDestroyed) {
        proj._destroy()
      }
    }
    this.projectiles = []
    this.activeSpinner = null
    this.activeFlame = null
    this.projectileGroup.clear(true, true)
  }

  // ============================================================
  // UTILITY - Helper methods
  // ============================================================

  /**
   * Redraw the player polygon.
   * Call this after changing the number of sides.
   */
  updatePolygon(): void {
    this.Draw()
  }
}
