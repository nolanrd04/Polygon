import Phaser from 'phaser'
import { getEnemyRegistry } from '../entities/enemies'
import type { Enemy } from '../entities/enemies/Enemy'
import { Projectile } from '../entities/projectiles/Projectile'
import { WORLD_WIDTH, WORLD_HEIGHT } from '../core/GameConfig'
import type { Difficulty } from './difficulty/Difficulty'
import { NormalDifficulty } from './difficulty/Normal'

// Get the registry from the centralized enemies/index.ts
// Now to add a new enemy, just edit enemies/index.ts!
const EnemyRegistry = getEnemyRegistry()

export class EnemyManager {
  private scene: Phaser.Scene
  private difficulty: Difficulty
  private enemies: Enemy[] = []
  private enemyGroup: Phaser.GameObjects.Group
  private projectiles: Projectile[] = []
  private enemyProjectileGroup: Phaser.GameObjects.Group
  private nextId: number = 1
  private currentWave: number = 0

  constructor(scene: Phaser.Scene, difficulty: Difficulty = NormalDifficulty) {
    this.scene = scene
    this.difficulty = difficulty
    this.enemyGroup = scene.add.group()
    this.enemyProjectileGroup = scene.add.group()

    // Enable enemy-to-enemy collision (prevents overlapping)
    this.scene.physics.add.collider(
      this.enemyGroup,
      this.enemyGroup,
      this.handleEnemyEnemyCollision.bind(this) as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback
    )
  }

  /**
   * Enemy-vs-enemy contact.
   *
   * Separation is left to Arcade as before; this only adds the optional shove
   * for enemies that opted into `knockbackEnemies` (a boss ploughing through
   * the crowd rather than politely displacing it). Checked in both directions,
   * since either or both bodies may be a barger.
   */
  private handleEnemyEnemyCollision(
    containerA: Phaser.Tilemaps.Tile | Phaser.Types.Physics.Arcade.GameObjectWithBody,
    containerB: Phaser.Tilemaps.Tile | Phaser.Types.Physics.Arcade.GameObjectWithBody
  ): void {
    const enemyA = (containerA as Phaser.GameObjects.Container).getData('enemyInstance') as Enemy | undefined
    const enemyB = (containerB as Phaser.GameObjects.Container).getData('enemyInstance') as Enemy | undefined

    if (!enemyA || !enemyB) return

    this.barge(enemyA, enemyB)
    this.barge(enemyB, enemyA)
  }

  /**
   * Knock `target` away along `knocker`'s current velocity.
   *
   * No-ops when the knocker isn't a barger, and `applyKnockback` itself
   * no-ops when the target is knockback-immune - which is how the parts of a
   * multi-part boss avoid shoving each other while overlapping.
   */
  private barge(knocker: Enemy, target: Enemy): void {
    if (!knocker.knockbackEnemies) return
    if (knocker.isDestroyed || target.isDestroyed) return

    const strength = knocker.knockbackEnemiesStrength
    target.applyKnockback(knocker.velocityX * strength, knocker.velocityY * strength)
  }

  /**
   * Spawn an enemy by type ID.
   *
   * @param configure  Optional hook run after SetDefaults() and wave scaling
   *                   but before the enemy is built. Use it when one enemy
   *                   derives another's stats from its own already-scaled
   *                   values (the Arrow Head boss configuring its segments):
   *                   scaling has already happened, so derived stats are never
   *                   scaled twice, and nothing has been created yet, so
   *                   radius/scale/hitbox changes still take effect normally.
   */
  spawnEnemy(
    typeId: string,
    x?: number,
    y?: number,
    dropScore: boolean = true,
    dropBundle: boolean = true,
    configure?: (enemy: Enemy) => void
  ): Enemy | null {
    const EnemyClass = EnemyRegistry[typeId]
    if (!EnemyClass) {
      console.warn(`Unknown enemy type: ${typeId}`)
      return null
    }

    // Spawn at random edge if no position specified
    if (x === undefined || y === undefined) {
      const pos = this.getRandomEdgePosition()
      x = pos.x
      y = pos.y
    }

    const enemy = new EnemyClass()
    enemy.typeId = typeId
    enemy.SetDefaults()

    if (!dropScore) {
      enemy.scoreChance = 0
    }

    if (!dropScore && dropBundle) {
      enemy.bundleDropChance = enemy.scoreChance
    }

    if (!dropBundle) {
      enemy.bundleDropChance = 0
    }

    // Apply wave scaling from difficulty
    enemy.health *= this.difficulty.getHealthMultiplier(this.currentWave)
    enemy.damage *= this.difficulty.getDamageMultiplier(this.currentWave)
    enemy.speed *= this.difficulty.getSpeedMultiplier(this.currentWave, enemy.speedCap)
    enemy.maxHealth = enemy.health  // Update maxHealth to match scaled health

    // Reduce diamond enemy dash cooldown time as waves progress
    if (this.currentWave > 10) {
      if (typeId === 'diamond')
      {
        (enemy as any).waitFrames = 210
      }
    }
    else if (this.currentWave > 15) {
      if (typeId === 'diamond')
      {
        (enemy as any).waitFrames = 180
      }
    }
    else if (this.currentWave > 20) {
      if (typeId === 'diamond')
      {
        (enemy as any).waitFrames = 120
      }
    }

    // Runs last, so a spawner can override anything - including values the
    // wave scaling above just wrote.
    configure?.(enemy)

    enemy._spawn(this.scene, x, y, this.nextId++)

    this.enemies.push(enemy)
    this.enemyGroup.add(enemy.getContainer())

    return enemy
  }

  private getRandomEdgePosition(): { x: number; y: number } {
    const edge = Math.floor(Math.random() * 4)
    switch (edge) {
      case 0: return { x: Math.random() * WORLD_WIDTH, y: -50 }
      case 1: return { x: WORLD_WIDTH + 50, y: Math.random() * WORLD_HEIGHT }
      case 2: return { x: Math.random() * WORLD_WIDTH, y: WORLD_HEIGHT + 50 }
      case 3: return { x: -50, y: Math.random() * WORLD_HEIGHT }
      default: return { x: 0, y: 0 }
    }
  }

  /**
   * Update all enemies and enemy projectiles.
   */
  update(playerX: number, playerY: number): void {
    // Update enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i]

      if (enemy.isDestroyed) {
        this.enemies.splice(i, 1)
      } else {
        enemy._update(playerX, playerY)
      }
    }

    // Update enemy projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i]

      if (proj.isDestroyed || proj._isOutOfBounds(WORLD_WIDTH, WORLD_HEIGHT)) {
        if (!proj.isDestroyed) proj._destroy()
        this.projectiles.splice(i, 1)
      } else {
        proj._update()
      }
    }
  }

  /**
   * Get all active enemies.
   */
  getEnemies(): Enemy[] {
    return this.enemies.filter(e => !e.isDestroyed)
  }

  /**
   * Get the Phaser group for collision detection.
   */
  getGroup(): Phaser.GameObjects.Group {
    return this.enemyGroup
  }

  getActiveCount(): number {
    return this.enemies.filter(e => !e.isDestroyed).length
  }

  clear(): void {
    for (const enemy of this.enemies) {
      enemy._destroy()
    }
    this.enemies = []
    this.enemyGroup.clear(true, true)

    for (const proj of this.projectiles) {
      proj._destroy()
    }
    this.projectiles = []
    this.enemyProjectileGroup.clear(true, true)
  }

  /**
   * Set the current wave for enemy scaling.
   */
  setCurrentWave(wave: number): void {
    this.currentWave = wave
  }

  /**
   * Add an enemy projectile to the manager.
   * Called by Enemy.newProjectile() when spawning projectiles.
   */
  addProjectile(projectile: Projectile, container: Phaser.GameObjects.Container): void {
    this.projectiles.push(projectile)
    this.enemyProjectileGroup.add(container)
  }

  /**
   * Get the enemy projectile group for collision detection.
   */
  getEnemyProjectileGroup(): Phaser.GameObjects.Group {
    return this.enemyProjectileGroup
  }

  /**
   * Get all active enemy projectiles.
   */
  getProjectiles(): Projectile[] {
    return this.projectiles
  }
}
