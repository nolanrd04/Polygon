import Phaser from 'phaser'
import { Player } from '../entities/Player'
import { Enemy } from '../entities/enemies/Enemy'
import { EnemyManager } from './EnemyManager'
import { GameManager } from '../core/GameManager'
import { UpgradeEffectSystem, UpgradeModifierSystem } from './upgrades'

export class CollisionManager {
  private scene: Phaser.Scene
  private player: Player
  private enemyManager: EnemyManager
  private obstacles: Phaser.GameObjects.Group | null = null
  private lastPlayerDamageTime: number = 0
  private playerDamageCooldown: number = 500 // milliseconds

  constructor(
    scene: Phaser.Scene,
    player: Player,
    enemyManager: EnemyManager,
    obstacles?: Phaser.GameObjects.Group
  ) {
    this.scene = scene
    this.player = player
    this.enemyManager = enemyManager
    this.obstacles = obstacles || null

    this.setupCollisions()
  }

  private setupCollisions(): void {
    // Player Projectile vs Enemy
    this.scene.physics.add.overlap(
      this.player.getProjectileGroup(),
      this.enemyManager.getGroup(),
      this.handleProjectileEnemyCollision.bind(this) as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback
    )

    // Enemy Projectile vs Player
    this.scene.physics.add.overlap(
      this.enemyManager.getEnemyProjectileGroup(),
      this.player,
      this.handleEnemyProjectilePlayerCollision.bind(this) as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback
    )

    // Player vs Enemy (damage overlap)
    this.scene.physics.add.overlap(
      this.player,
      this.enemyManager.getGroup(),
      this.handlePlayerEnemyCollision.bind(this) as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback
    )

    // Player vs Enemy (solid collision - prevents passing through)
    this.scene.physics.add.collider(this.player, this.enemyManager.getGroup())

    // Setup obstacle collisions if obstacles exist
    if (this.obstacles) {
      // Player vs Obstacles
      this.scene.physics.add.collider(this.player, this.obstacles)

      // Player Projectiles vs Obstacles
      this.scene.physics.add.collider(
        this.player.getProjectileGroup(),
        this.obstacles,
        this.handleProjectileObstacleCollision.bind(this) as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
        this.processProjectileObstacleCollision.bind(this) as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback
      )

      // Enemy Projectiles vs Obstacles
      this.scene.physics.add.collider(
        this.enemyManager.getEnemyProjectileGroup(),
        this.obstacles,
        this.handleProjectileObstacleCollision.bind(this) as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
        this.processProjectileObstacleCollision.bind(this) as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback
      )

      // Enemies vs Obstacles
      this.scene.physics.add.collider(this.enemyManager.getGroup(), this.obstacles)
    }
  }

  private handleProjectileEnemyCollision(
    projectileContainer: Phaser.Tilemaps.Tile | Phaser.Types.Physics.Arcade.GameObjectWithBody,
    enemyContainer: Phaser.Tilemaps.Tile | Phaser.Types.Physics.Arcade.GameObjectWithBody
  ): void {
    // Get the actual Projectile and Enemy instances from the containers
    const projContainer = projectileContainer as Phaser.GameObjects.Container
    const enemyContainerObj = enemyContainer as Phaser.GameObjects.Container

    if (!projContainer.active || !enemyContainerObj.active) return

    // Find the projectile instance that owns this container
    const projectile = this.player.getProjectiles().find(p => p.getContainer() === projContainer)
    const enemy = enemyContainerObj.getData('enemyInstance') as Enemy

    if (!projectile || !enemy || projectile.isDestroyed || enemy.isDestroyed) return

    // Check if this projectile already hit this enemy (for pierce)
    if (!projectile._canHitEnemy(enemy.id)) return

    // Trigger onHit effects (lifesteal, etc.)
    UpgradeEffectSystem.onProjectileHit(projectile, enemy)

    // Check if projectile wants to handle damage (e.g., ExplosiveBullet returns false to handle via explosion)
    const shouldApplyCollisionDamage = projectile.OnHitNPC(enemy)

    // Apply damage modifiers and round up to nearest whole number
    const baseDamage = projectile.damage
    const modifiedDamage = UpgradeModifierSystem.applyModifiers('bullet', 'damage', baseDamage)
    const multipliedDamage = modifiedDamage * projectile.damageMultiplier
    const finalDamage = Math.ceil(multipliedDamage)

    // Deal damage if projectile allows it
    let killed = false
    if (shouldApplyCollisionDamage) {
      killed = enemy.takeDamage(finalDamage)
    }

    if (killed) {
      // Increment kill counter
      GameManager.addKill()

      // Award 1 point based on scoreChance (0 to 1)
      if (Math.random() < enemy.scoreChance) {
        GameManager.addPoints(1)
      }

      // Trigger onKill effects (explode on kill, etc.)
      UpgradeEffectSystem.onEnemyKill(enemy)
    }

    // Record hit (handles pierce logic and may destroy projectile)
    projectile._recordHit(enemy.id)
    // Apply knockback to enemy
    if (projectile.knockback > 0) {
      const baseKnockback = projectile.knockback
      const modifiedKnockback = UpgradeModifierSystem.applyModifiers('attack', 'knockback', baseKnockback)
      const angle = Phaser.Math.Angle.Between(
        projectile.positionX,
        projectile.positionY,
        enemy.x,
        enemy.y
      )
      enemy.applyKnockback(
        Math.cos(angle) * modifiedKnockback,
        Math.sin(angle) * modifiedKnockback
      )
    }
  }

  private handleEnemyProjectilePlayerCollision(
    projectileContainer: Phaser.Tilemaps.Tile | Phaser.Types.Physics.Arcade.GameObjectWithBody,
    _playerObj: Phaser.Tilemaps.Tile | Phaser.Types.Physics.Arcade.GameObjectWithBody
  ): void {
    // Get the actual Projectile instance from the container
    const projContainer = projectileContainer as Phaser.GameObjects.Container

    if (!projContainer.active) return

    // Find the projectile instance that owns this container
    const projectile = this.enemyManager.getProjectiles().find(p => p.getContainer() === projContainer)

    if (!projectile || projectile.isDestroyed) return

    // Check damage cooldown
    const now = this.scene.time.now
    if (now - this.lastPlayerDamageTime < this.playerDamageCooldown) return

    // Damage player
    console.log(`Enemy projectile hitting player with damage: ${projectile.damage}`)
    this.player.takeDamage(Math.ceil(projectile.damage))
    this.lastPlayerDamageTime = now

    // Destroy the projectile
    projectile._destroy()

    // Push player away
    const angle = Phaser.Math.Angle.Between(
      projectile.positionX,
      projectile.positionY,
      this.player.x,
      this.player.y
    )

    const pushForce = 150
    this.player.body.setVelocity(
      Math.cos(angle) * pushForce,
      Math.sin(angle) * pushForce
    )
  }

  private handlePlayerEnemyCollision(
    _playerObj: Phaser.Tilemaps.Tile | Phaser.Types.Physics.Arcade.GameObjectWithBody,
    enemyContainer: Phaser.Tilemaps.Tile | Phaser.Types.Physics.Arcade.GameObjectWithBody
  ): void {
    const enemyContainerObj = enemyContainer as Phaser.GameObjects.Container
    const enemy = enemyContainerObj.getData('enemyInstance') as Enemy

    if (!enemy || enemy.isDestroyed) return

    // Check damage cooldown
    const now = this.scene.time.now
    if (now - this.lastPlayerDamageTime < this.playerDamageCooldown) return

    // Damage player (round up to nearest whole number)
    const damageAmount = Math.ceil(enemy.damage)
    this.player.takeDamage(damageAmount)
    this.lastPlayerDamageTime = now

    // Handle thorns - damage the enemy that hit the player
    if (UpgradeEffectSystem.hasEffect('thorns')) {
      const thornsDamage = damageAmount * UpgradeEffectSystem.getEffectValue('thorns')
      enemy.takeDamage(thornsDamage)
    }

    // Push player away
    const angle = Phaser.Math.Angle.Between(
      enemy.x,
      enemy.y,
      this.player.x,
      this.player.y
    )

    const pushForce = 200
    this.player.body.setVelocity(
      Math.cos(angle) * pushForce,
      Math.sin(angle) * pushForce
    )
  }

  /**
   * ProcessCallback: Determines if collision should happen.
   * Return true to block projectile, false to let it pass through.
   */
  private processProjectileObstacleCollision(
    projectileContainer: Phaser.Tilemaps.Tile | Phaser.Types.Physics.Arcade.GameObjectWithBody,
    _obstacle: Phaser.Tilemaps.Tile | Phaser.Types.Physics.Arcade.GameObjectWithBody
  ): boolean {
    const container = projectileContainer as Phaser.GameObjects.Container

    // Find the projectile instance by matching container (same approach as enemy collision)
    let projectile = this.player.getProjectiles().find(p => p.getContainer() === container)
    if (!projectile) {
      projectile = this.enemyManager.getProjectiles().find(p => p.getContainer() === container)
    }

    if (!projectile || projectile.isDestroyed) return false

    // Trigger obstacle collision callback
    projectile.OnObstacleCollide()

    // If projectile can cut tiles, let it pass through but count pierce
    if (projectile.canCutTiles) {
      projectile.currentPierceCount++
      if (projectile.currentPierceCount >= projectile.pierce) {
        projectile._destroy()
      }
      return false // Don't block - let it pass through
    }

    // If ricochet is active, don't destroy - let it bounce
    if (UpgradeEffectSystem.hasEffect('ricochet')) {
      return false // Let the projectile bounce back
    }

    // Can't cut tiles and no ricochet - destroy immediately to prevent pass-through
    projectile._destroy()
    return false // Return false to prevent collision response since projectile is destroyed
  }

  /**
   * CollisionCallback: Called when collision actually happens (processCallback returned true).
   * Not used anymore since we destroy in processCallback.
   */
  private handleProjectileObstacleCollision(
    _projectileContainer: Phaser.Tilemaps.Tile | Phaser.Types.Physics.Arcade.GameObjectWithBody,
    _obstacle: Phaser.Tilemaps.Tile | Phaser.Types.Physics.Arcade.GameObjectWithBody
  ): void {
    // Not needed - destruction handled in processCallback
  }
}
