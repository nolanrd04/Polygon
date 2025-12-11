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
  private lastPlayerDamageTime: number = 0
  private playerDamageCooldown: number = 500 // milliseconds

  constructor(
    scene: Phaser.Scene,
    player: Player,
    enemyManager: EnemyManager
  ) {
    this.scene = scene
    this.player = player
    this.enemyManager = enemyManager

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

    // Player vs Enemy
    this.scene.physics.add.overlap(
      this.player,
      this.enemyManager.getGroup(),
      this.handlePlayerEnemyCollision.bind(this) as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback
    )
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

    // Apply damage modifiers and round up to nearest whole number
    const baseDamage = projectile.damage
    const modifiedDamage = UpgradeModifierSystem.applyModifiers('bullet', 'damage', baseDamage)
    const multipliedDamage = modifiedDamage * projectile.damageMultiplier
    const finalDamage = Math.ceil(multipliedDamage)

    // Deal damage and record hit
    const killed = enemy.takeDamage(finalDamage)

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
    projectile._recordHit(enemy.id, enemy)
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
}
