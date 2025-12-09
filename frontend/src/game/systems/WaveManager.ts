import Phaser from 'phaser'
import { EnemyManager } from './EnemyManager'
import { GameManager } from '../core/GameManager'
import { EventBus } from '../core/EventBus'

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
    return Math.floor(40 + this.currentWave * 2 + Math.pow(this.currentWave, 1.2))
  }

  private spawnEnemiesGradually(): void {
    const spawnDelay = Math.max(25, Math.min(500, 1000 - this.currentWave * 50))

    const spawnTimer = this.scene.time.addEvent({
      delay: spawnDelay,
      callback: () => {
        if (this.enemiesSpawned < this.totalEnemiesToSpawn) {
          const types = this.getAvailableEnemyTypes()
          const typeId = types[Math.floor(Math.random() * types.length)]
          this.enemyManager.spawnEnemy(typeId)
          this.enemiesSpawned++
        } else {
          spawnTimer.destroy()
        }
      },
      loop: true
    })
  }

  private getAvailableEnemyTypes(): string[] {
    const types: string[] = ['triangle']

    if (this.currentWave >= 4) types.push('square')
    if (this.currentWave >= 7) types.push('pentagon')
    if (this.currentWave >= 11) types.push('hexagon')

    return types
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
}
