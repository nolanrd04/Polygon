import Phaser from 'phaser'
import { EnemyManager } from './EnemyManager'
import { GameManager } from '../core/GameManager'
import { EventBus } from '../core/EventBus'
import { waveValidation } from '../services/WaveValidation'
import type { Difficulty, EnemySpawnWeight, RarityWeights } from './difficulty/Difficulty'
import { NormalDifficulty } from './difficulty/Normal'

export class WaveManager {
  private scene: Phaser.Scene
  private enemyManager: EnemyManager
  private difficulty: Difficulty
  private currentWave: number = 1
  private waveActive: boolean = false
  private enemiesSpawned: number = 0
  private totalEnemiesToSpawn: number = 0

  constructor(scene: Phaser.Scene, enemyManager: EnemyManager, difficulty: Difficulty = NormalDifficulty) {
    this.scene = scene
    this.enemyManager = enemyManager
    this.difficulty = difficulty
  }

  async startNextWave(): Promise<void> {
    this.waveActive = true

    GameManager.setWave(this.currentWave)

    console.log(`Wave ${this.currentWave} starting with pre-loaded upgrades`)

    this.enemyManager.scaleEnemyStats(this.currentWave - 1)

    const bossSpawns = this.difficulty.getScheduledBossSpawns(this.currentWave)
    if (bossSpawns) {
      this.startBossWave(bossSpawns)
    } else {
      this.startNormalWave()
    }

    GameManager.startWave()
    EventBus.emit('wave-start', this.currentWave)
  }

  private startNormalWave(): void {
    this.totalEnemiesToSpawn = this.difficulty.getEnemyCount(this.currentWave)
    this.enemiesSpawned = 0
    this.spawnEnemiesGradually()
  }

  private startBossWave(bossSpawns: string[]): void {
    // Boss waves halve the regular pool; the boss spawns in addition.
    this.totalEnemiesToSpawn = Math.floor(this.difficulty.getEnemyCount(this.currentWave) * 0.5)
    this.enemiesSpawned = 0

    this.spawnEnemiesGradually()

    this.scene.time.delayedCall(2000, () => {
      console.log(`Spawning boss for wave ${this.currentWave}`)
      for (const typeId of bossSpawns) {
        this.enemyManager.spawnEnemy(typeId)
      }
    })
  }

  private spawnEnemiesGradually(): void {
    const spawnDelay = this.difficulty.getSpawnDelay(this.currentWave)

    const spawnTimer = this.scene.time.addEvent({
      delay: spawnDelay,
      callback: () => {
        if (this.enemiesSpawned < this.totalEnemiesToSpawn) {
          const weights = this.difficulty.getSpawnWeights(this.currentWave)
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

  private selectWeightedRandom(weights: EnemySpawnWeight[]): string {
    const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0)
    let random = Math.random() * totalWeight

    for (const entry of weights) {
      random -= entry.weight
      if (random <= 0) {
        return entry.type
      }
    }

    return weights[0].type
  }

  isWaveComplete(): boolean {
    return (
      this.waveActive &&
      this.enemiesSpawned >= this.totalEnemiesToSpawn &&
      this.enemyManager.getActiveCount() === 0
    )
  }

  async completeWave(): Promise<void> {
    this.waveActive = false

    const validationResult = await waveValidation.completeWave(this.currentWave)
    if (!validationResult.success) {
      console.warn('Wave validation failed:', validationResult.errors)
    } else {
      console.log(`Wave ${this.currentWave} validated successfully`)
    }

    this.scene.events.emit('clear-projectiles')

    if (this.currentWave % 6 === 0 && this.currentWave > 0) {
      EventBus.emit('evolution-milestone', this.currentWave)
    }

    await GameManager.completeWave()

    this.currentWave++
    GameManager.setWave(this.currentWave)
    console.log(`Wave incremented to ${this.currentWave} after completion`)

    EventBus.emit('wave-start', this.currentWave)

    if (!GameManager.hasPlayerDiedThisSession()) {
      const { SaveManager } = await import('../services/SaveManager')
      await SaveManager.saveOnWaveComplete()
      console.log(`Saved incremented wave ${this.currentWave} to backend`)
    } else {
      console.log(`Skipping wave completion save - player died this session. Death save already marked as game_over.`)
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
    return this.difficulty.getScheduledBossSpawns(this.currentWave) !== null
  }

  getBundleDropChance(): number {
    return this.difficulty.getBundleDropChance(this.currentWave)
  }

  getBundleRarityWeights(): RarityWeights {
    return this.difficulty.getBundleRarityWeights(this.currentWave)
  }

  getRarityWeights(): RarityWeights {
    return this.difficulty.getRarityWeights(this.currentWave)
  }

  getDifficultyId(): string {
    return this.difficulty.id
  }

  setWave(wave: number): void {
    this.currentWave = wave
    this.waveActive = false
    this.enemiesSpawned = 0
    this.totalEnemiesToSpawn = 0

    GameManager.setWave(wave)

    EventBus.emit('wave-start', wave)
  }
}