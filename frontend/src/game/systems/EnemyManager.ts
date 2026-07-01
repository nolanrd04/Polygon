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
    this.scene.physics.add.collider(this.enemyGroup, this.enemyGroup)
  }

  /**
   * Spawn an enemy by type ID.
   */
  spawnEnemy(typeId: string, x?: number, y?: number): Enemy | null {
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
    enemy.SetDefaults()

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
