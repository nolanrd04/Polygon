import Phaser from 'phaser'
import { getEnemyRegistry } from '../entities/enemies'
import type { Enemy } from '../entities/enemies/Enemy'
import { Projectile } from '../entities/projectiles/Projectile'
import { GAME_WIDTH, GAME_HEIGHT } from '../core/GameConfig'

// Get the registry from the centralized enemies/index.ts
// Now to add a new enemy, just edit enemies/index.ts!
const EnemyRegistry = getEnemyRegistry()

export class EnemyManager {
  private scene: Phaser.Scene
  private enemies: Enemy[] = []
  private enemyGroup: Phaser.GameObjects.Group
  private projectiles: Projectile[] = []
  private enemyProjectileGroup: Phaser.GameObjects.Group
  private nextId: number = 1
  private currentWave: number = 0
  private waveMultiplier: number = 1

  constructor(scene: Phaser.Scene) {
    this.scene = scene
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

    // Apply wave scaling
    enemy.health *= this.waveMultiplier
    enemy.damage *= this.waveMultiplier
    enemy.speed *= this.getSpeedMultiplier(this.currentWave, enemy.speedCap)
    enemy.maxHealth = enemy.health  // Update maxHealth to match scaled health
    // console.log(`Spawning enemy ${typeId} at (${x}, ${y}) with health ${enemy.health.toFixed(2)}`)

    enemy._spawn(this.scene, x, y, this.nextId++)

    this.enemies.push(enemy)
    this.enemyGroup.add(enemy.getContainer())

    return enemy
  }

  private getRandomEdgePosition(): { x: number; y: number } {
    const edge = Math.floor(Math.random() * 4)
    switch (edge) {
      case 0: return { x: Math.random() * GAME_WIDTH, y: -50 }
      case 1: return { x: GAME_WIDTH + 50, y: Math.random() * GAME_HEIGHT }
      case 2: return { x: Math.random() * GAME_WIDTH, y: GAME_HEIGHT + 50 }
      case 3: return { x: -50, y: Math.random() * GAME_HEIGHT }
      default: return { x: 0, y: 0 }
    }
  }

  /**
   * Spawn a wave of enemies.
   */
  spawnWave(wave: number): void {
    this.currentWave = wave
    this.scaleEnemyStats(wave)
    
    const count = this.getEnemyCount(wave)
    const types = this.getAvailableTypes(wave)

    for (let i = 0; i < count; i++) {
      const typeId = types[Math.floor(Math.random() * types.length)]
      this.scene.time.delayedCall(i * 500, () => {
        this.spawnEnemy(typeId)
      })
    }
  }

  private getEnemyCount(wave: number): number {
    return Math.floor(5 + wave * 2 + Math.pow(wave, 1.2))
  }

  private getAvailableTypes(wave: number): string[] {
    const types: string[] = ['triangle']

    if (wave >= 3) types.push('square')
    if (wave >= 5) types.push('dasher')
    if (wave >= 6) types.push('pentagon')
    if (wave >= 7) types.push('shooter')
    if (wave >= 8) types.push('exploder')
    if (wave >= 10) types.push('hexagon')

    return types
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

      if (proj.isDestroyed || proj._isOutOfBounds(GAME_WIDTH, GAME_HEIGHT)) {
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
   * Scale enemy stats based on wave number.
   * Uses exponential scaling: e^(wave/8)
   * At wave 0: multiplier = 1
   * Increases gradually but exponentially with each wave
   */
  scaleEnemyStats(wave: number): void {
    this.waveMultiplier = Math.exp(wave / 6)
  }

  /**
   * Get the speed multiplier for the current wave.
   * Respects each enemy's individual speedCap.
   */
  private getSpeedMultiplier(wave: number, speedCap: number): number {
    const speedMult = 1 + (wave * 0.1) // +10% speed per wave
    return Math.min(speedCap, speedMult)
  }

  /**
   * Get the current wave multiplier for enemy stats.
   */
  getWaveMultiplier(): number {
    return this.waveMultiplier
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
