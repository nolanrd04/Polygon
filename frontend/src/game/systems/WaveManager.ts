import Phaser from 'phaser'
import { EnemyManager } from './EnemyManager'
import { GameManager } from '../core/GameManager'
import { EventBus } from '../core/EventBus'

type EnemySpawnWeight = {
  type: string
  weight: number
}

export class WaveManager {
  private scene: Phaser.Scene
  private enemyManager: EnemyManager
  private currentWave: number = 0
  private waveActive: boolean = false
  private enemiesSpawned: number = 0
  private totalEnemiesToSpawn: number = 0

  constructor(scene: Phaser.Scene, enemyManager: EnemyManager) {
    this.scene = scene
    this.enemyManager = enemyManager
  }

  startNextWave(): void {
    this.currentWave++
    this.waveActive = true

    // Sync GameManager's wave counter
    GameManager.setWave(this.currentWave)

    // Scale enemy stats for this wave (use currentWave - 1 since wave 1 should have wave 0 multiplier)
    this.enemyManager.scaleEnemyStats(this.currentWave - 1)

    // Determine if this is a boss wave
    if (this.currentWave % 10  === 0 && this.currentWave < 31) {
      this.startBossWave()
    } else {
      this.startNormalWave()
    }

    GameManager.startWave()
    EventBus.emit('wave-start', this.currentWave)
  }

  private startNormalWave(): void {
    this.totalEnemiesToSpawn = this.calculateEnemyCount()
    this.enemiesSpawned = 0

    this.spawnEnemiesGradually()
  }

  private startBossWave(): void {
    // Boss waves have fewer regular enemies plus a boss
    this.totalEnemiesToSpawn = Math.floor(this.calculateEnemyCount() * 0.5)
    this.enemiesSpawned = 0

    this.spawnEnemiesGradually()

    // Spawn boss after delay
    this.scene.time.delayedCall(2000, () => {
      this.spawnBoss()
    })
  }

  private calculateEnemyCount(): number {
    // const spawnCount = 30
    if (this.currentWave == 1 || this.currentWave == 3)
    {
      return 30
    }
    else if (this.currentWave == 2)
    {
      return 35
    }
    else if (this.currentWave == 4 || this.currentWave == 5)
    {
      return 40
    }
    else if (this.currentWave == 6)
    {
      return 60
    }
    else if (this.currentWave == 7)
    {
      return 45
    }
    else if (this.currentWave == 8)
    {
      return 50
    }
    else if (this.currentWave == 9 || this.currentWave == 10)
    {
      return 60
    }
    else if (this.currentWave == 11)
    {
      return 70
    }
    else if (this.currentWave == 12)  
    {
      return 80
    }
    else if (this.currentWave == 13 || this.currentWave == 14)
    {
      return 100
    }
    else if (this.currentWave == 15)
    {
      return 85
    }
    else if (this.currentWave == 16)
    {
      return 90
    }
    else if (this.currentWave == 17)
    {
      return 80
    }
    else if (this.currentWave == 18 || this.currentWave == 19)
    {
      return 100
    }

    else 
    {
      return Math.floor(100 + this.currentWave * 2 + Math.pow(this.currentWave, 1.2))
    }
  }

  private spawnEnemiesGradually(): void {
    const spawnDelay = Math.max(50, 1000 - this.currentWave * 25)

    const spawnTimer = this.scene.time.addEvent({
      delay: spawnDelay,
      callback: () => {
        if (this.enemiesSpawned < this.totalEnemiesToSpawn) {
          const weights = this.getEnemySpawnWeights()
          const typeId = this.selectWeightedRandom(weights)
          this.enemyManager.spawnEnemy(typeId)
          this.enemiesSpawned++
        } else {
          spawnTimer.destroy()
        }
      },
      loop: true
    })
  }

  /**
   * Define spawn weights for each wave.
   * Higher weight = more likely to spawn.
   * Customize these values to control enemy proportions!
   */
  private getEnemySpawnWeights(): EnemySpawnWeight[] {
    const weights: EnemySpawnWeight[] = []

    // Wave 1-2: Only triangles
    if (this.currentWave < 3) {
      weights.push({ type: 'triangle', weight: 100 })
    }
    // Wave 3-4: Mostly triangles, some squares
    else if (this.currentWave < 5) {
      weights.push({ type: 'triangle', weight: 70 })
      weights.push({ type: 'square', weight: 30 })
    }
    // Wave 5-6: Add shooters (rare)
    else if (this.currentWave < 7) {
      weights.push({ type: 'triangle', weight: 60 })
      weights.push({ type: 'square', weight: 30 })
      weights.push({ type: 'super_triangle', weight: 10 })
    }
    // Wave 7: Add pentagons, more shooters
    else if (this.currentWave == 7) {
      weights.push({ type: 'triangle', weight: 40 })
      weights.push({ type: 'square', weight: 25 })
      weights.push({ type: 'super_triangle', weight: 20 })
      weights.push({ type: 'pentagon', weight: 15 })
    }
    // Wave 8-10: Introduce diamonds
    else if (this.currentWave < 11) {
      weights.push({ type: 'triangle', weight: 30 })
      weights.push({ type: 'square', weight: 20 })
      weights.push({ type: 'super_triangle', weight: 20 })
      weights.push({ type: 'pentagon', weight: 15 })
      weights.push({ type: 'diamond', weight: 15 })
    }
    else if (this.currentWave == 11)
    {
      weights.push({ type: 'triangle', weight: 25 })
      weights.push({ type: 'square', weight: 20 })
      weights.push({ type: 'super_triangle', weight: 20 })
      weights.push({ type: 'pentagon', weight: 15 })
      weights.push({ type: 'diamond', weight: 15 })
      weights.push({ type: 'hexagon', weight: 5 })
    }
    else if (this.currentWave == 12)
    {
      weights.push({ type: 'triangle', weight: 20 })
      weights.push({ type: 'square', weight: 20 })
      weights.push({ type: 'super_triangle', weight: 20 })
      weights.push({ type: 'pentagon', weight: 15 })
      weights.push({ type: 'diamond', weight: 20 })
      weights.push({ type: 'hexagon', weight: 5 })
    }
    else if (this.currentWave == 13)
    {
      weights.push({ type: 'triangle', weight: 10 })
      weights.push({ type: 'square', weight: 20 })
      weights.push({ type: 'super_triangle', weight: 45 })
      weights.push({ type: 'pentagon', weight: 15 })
      weights.push({ type: 'diamond', weight: 10 })
    }
    else if (this.currentWave == 14)
    {
      weights.push({ type: 'triangle', weight: 10 })
      weights.push({ type: 'square', weight: 10 })
      weights.push({ type: 'super_triangle', weight: 20 })
      weights.push({ type: 'pentagon', weight: 15 })
      weights.push({ type: 'diamond', weight: 45 })
    }
    else if (this.currentWave == 15)
      // introduce octogons
    {
      weights.push({ type: 'square', weight: 30 })
      weights.push({ type: 'super_triangle', weight: 20 })
      weights.push({ type: 'pentagon', weight: 15 })
      weights.push({ type: 'diamond', weight: 20 })
      weights.push({ type: 'hexagon', weight: 5 })
      weights.push({type: 'octogon', weight: 10})
    }
    else if (this.currentWave == 16)
    {
      weights.push({ type: 'square', weight: 25 })
      weights.push({ type: 'super_triangle', weight: 20 })
      weights.push({ type: 'pentagon', weight: 15 })
      weights.push({ type: 'diamond', weight: 15 })
      weights.push({ type: 'hexagon', weight: 10 })
      weights.push({type: 'octogon', weight: 15})
    }
    else if (this.currentWave == 17)
      // introducte super squares
    {
      weights.push({ type: 'triangle', weight: 20 })
      weights.push({ type: 'square', weight: 35 })
      weights.push({ type: 'super_triangle', weight: 15 })
      weights.push({type: 'octogon', weight: 5})
      weights.push({type: 'super_square', weight: 25})
    }
    else if (this.currentWave == 18)
    {
      weights.push({ type: 'square', weight: 40 })
      weights.push({ type: 'super_triangle', weight: 15 })
      weights.push({type: 'octogon', weight: 10})
      weights.push({type: 'super_square', weight: 35})
    }
    else if (this.currentWave == 19)
    {
      weights.push({ type: 'square', weight: 20 })
      weights.push({ type: 'super_triangle', weight: 10 })
      weights.push({ type: 'pentagon', weight: 5 })
      weights.push({ type: 'diamond', weight: 15 })
      weights.push({ type: 'hexagon', weight: 10 })
      weights.push({type: 'octogon', weight: 15})
      weights.push({type: 'super_square', weight: 25})
    }
    // Wave +: Full variety with hexagons
    else {
      weights.push({ type: 'triangle', weight: 5 })
      weights.push({ type: 'square', weight: 10 })
      weights.push({ type: 'super_triangle', weight: 20 })
      weights.push({ type: 'pentagon', weight: 10 })
      weights.push({ type: 'hexagon', weight: 10 })
      weights.push({ type: 'diamond', weight: 20 })
      weights.push({type: 'octogon', weight: 15})
      weights.push({type: 'super_square', weight: 10})
    }

    return weights
  }

  /**
   * Select a random enemy type based on weights.
   * Higher weight = higher chance of being selected.
   */
  private selectWeightedRandom(weights: EnemySpawnWeight[]): string {
    const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0)
    let random = Math.random() * totalWeight

    for (const entry of weights) {
      random -= entry.weight
      if (random <= 0) {
        return entry.type
      }
    }

    // Fallback (should never happen)
    return weights[0].type
  }

  private spawnBoss(): void {
    // Boss spawning will be implemented with boss entities
    console.log(`Spawning boss for wave ${this.currentWave}`)
    // For now, spawn extra strong enemies
    for (let i = 0; i < 3; i++) {
      this.enemyManager.spawnEnemy('hexagon')
    }

    this.enemyManager.spawnEnemy('dodecahedron')
  }

  isWaveComplete(): boolean {
    return (
      this.waveActive &&
      this.enemiesSpawned >= this.totalEnemiesToSpawn &&
      this.enemyManager.getActiveCount() === 0
    )
  }

  completeWave(): void {
    this.waveActive = false

    // Clear all projectiles
    this.scene.events.emit('clear-projectiles')

    GameManager.completeWave()
    if (this.currentWave % 6 === 0 && this.currentWave > 0) {
      EventBus.emit('evolution-milestone', this.currentWave)
    }
  }

  getCurrentWave(): number {
    return this.currentWave
  }

  isWaveActive(): boolean {
    return this.waveActive
  }

  isPrimeWave(): boolean {
    return this.isPrime(this.currentWave)
  }

  private isPrime(num: number): boolean {
    if (num < 2) return false
    for (let i = 2; i <= Math.sqrt(num); i++) {
      if (num % i === 0) return false
    }
    return true
  }

  isBossWave(): boolean {
    return this.currentWave % 10 === 0
  }

  setWave(wave: number): void {
    this.currentWave = wave - 1
    this.waveActive = false
    this.enemiesSpawned = 0
    this.totalEnemiesToSpawn = 0

    // Sync GameManager's wave counter
    GameManager.setWave(wave)

    // Emit wave-start event to update UI
    EventBus.emit('wave-start', wave)
  }
}
