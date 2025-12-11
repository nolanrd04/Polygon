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
    if (this.currentWave % 10  === 0) {
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
    const spawnCount = 30
    if (this.currentWave == 1 || this.currentWave == 3)
    {
      return spawnCount
    }
    else if (this.currentWave == 2)
    {
      return spawnCount + 5
    }
    else if (this.currentWave == 4 || this.currentWave == 5)
    {
      return spawnCount + 10
    }
    else if (this.currentWave == 6)
    {
      return spawnCount + 20
    }
    else if (this.currentWave == 7)
    {
      return spawnCount + 15
    }

    else 
    {
      return Math.floor(45 + this.currentWave * 2 + Math.pow(this.currentWave, 1.2))
    }
  }

  private spawnEnemiesGradually(): void {
    const spawnDelay = Math.max(50, Math.min(500, 1200 - this.currentWave * 50))

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
      weights.push({ type: 'shooter', weight: 10 })
    }
    // Wave 7-10: Add pentagons, more shooters
    else if (this.currentWave < 11) {
      weights.push({ type: 'triangle', weight: 40 })
      weights.push({ type: 'square', weight: 25 })
      weights.push({ type: 'shooter', weight: 20 })
      weights.push({ type: 'pentagon', weight: 15 })
    }
    // Wave 11+: Full variety with hexagons
    else {
      weights.push({ type: 'triangle', weight: 30 })
      weights.push({ type: 'square', weight: 20 })
      weights.push({ type: 'shooter', weight: 25 })
      weights.push({ type: 'pentagon', weight: 15 })
      weights.push({ type: 'hexagon', weight: 10 })
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
