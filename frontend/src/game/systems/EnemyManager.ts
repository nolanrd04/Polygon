import Phaser from 'phaser'
import { Enemy } from '../entities/enemies/Enemy'
import { Triangle } from '../entities/enemies/Triangle'
import { Square } from '../entities/enemies/Square'
import { Pentagon } from '../entities/enemies/Pentagon'
import { Hexagon } from '../entities/enemies/Hexagon'
import { GAME_WIDTH, GAME_HEIGHT } from '../core/GameConfig'

// Registry of all enemy types
const EnemyRegistry: Record<string, new () => Enemy> = {
  triangle: Triangle,
  square: Square,
  pentagon: Pentagon,
  hexagon: Hexagon,
}

/**
 * Register a new enemy type.
 * Call this to add custom enemies to the game.
 */
export function registerEnemy(id: string, enemyClass: new () => Enemy): void {
  EnemyRegistry[id] = enemyClass
}

export class EnemyManager {
  private scene: Phaser.Scene
  private enemies: Enemy[] = []
  private enemyGroup: Phaser.GameObjects.Group
  private nextId: number = 1
  private currentWave: number = 0
  private waveMultiplier: number = 1

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    this.enemyGroup = scene.add.group()
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
   * Update all enemies.
   */
  update(playerX: number, playerY: number): void {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i]

      if (enemy.isDestroyed) {
        this.enemies.splice(i, 1)
      } else {
        enemy._update(playerX, playerY)
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
  }

  /**
   * Scale enemy stats based on wave number.
   * Uses exponential scaling: e^(wave/8)
   * At wave 0: multiplier = 1
   * Increases gradually but exponentially with each wave
   */
  scaleEnemyStats(wave: number): void {
    this.waveMultiplier = Math.exp(wave / 8)
  }

  /**
   * Get the current wave multiplier for enemy stats.
   */
  getWaveMultiplier(): number {
    return this.waveMultiplier
  }
}
