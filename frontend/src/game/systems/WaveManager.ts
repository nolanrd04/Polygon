import Phaser from 'phaser'
import { EnemyManager } from './EnemyManager'
import { GameManager } from '../core/GameManager'
import { EventBus } from '../core/EventBus'
import { waveValidation } from '../services/WaveValidation'
import type { Difficulty, EnemySpawnWeight, RarityWeights } from './difficulty/Difficulty'
import { NormalDifficulty } from './difficulty/Normal'
import { getEnemyRegistry } from '../entities/enemies'
import {
  FRAGMENT_TIERS,
  distributeFragments,
  emptyFragments,
  rollWaveBudget,
  type FragmentCounts,
  type WaveFragmentBudget,
} from './FragmentBudget'

const EnemyRegistry = getEnemyRegistry()

interface PlannedSpawn {
  typeId: string
  fragments: FragmentCounts
}

export class WaveManager {
  private scene: Phaser.Scene
  private enemyManager: EnemyManager
  private difficulty: Difficulty
  private currentWave: number = 1
  private waveActive: boolean = false
  private enemiesSpawned: number = 0
  private totalEnemiesToSpawn: number = 0
  private plannedSpawns: PlannedSpawn[] = []
  private plannedBosses: PlannedSpawn[] = []
  private fragmentBudget: WaveFragmentBudget | null = null

  constructor(scene: Phaser.Scene, enemyManager: EnemyManager, difficulty: Difficulty = NormalDifficulty) {
    this.scene = scene
    this.enemyManager = enemyManager
    this.difficulty = difficulty
  }

  async startNextWave(): Promise<void> {
    this.waveActive = true

    GameManager.setWave(this.currentWave)

    console.log(`Wave ${this.currentWave} starting with pre-loaded upgrades`)

    this.enemyManager.setCurrentWave(this.currentWave - 1)

    this.planWave()
    this.enemiesSpawned = 0
    this.totalEnemiesToSpawn = this.plannedSpawns.length
    this.spawnEnemiesGradually()
    if (this.plannedBosses.length > 0) {
      this.spawnBossesDelayed()
    }

    // Same frame MainScene applies held bundle buffs on (GameManager.startWave's wave-start).
    waveValidation.markWaveStart()
    GameManager.startWave()
    EventBus.emit('wave-start', this.currentWave)
  }

  /** Rolls the whole wave's enemy list and hands the fragment budget out across it. */
  private planWave(): void {
    const bossTypes = this.difficulty.getScheduledBossSpawns(this.currentWave) ?? []
    const enemyCount = this.difficulty.getEnemyCount(this.currentWave)
    // Boss waves halve the regular pool; the boss spawns in addition.
    const regularCount = bossTypes.length > 0 ? Math.floor(enemyCount * 0.5) : enemyCount

    const weights = this.difficulty.getSpawnWeights(this.currentWave)
    const regularTypes = Array.from({ length: regularCount }, () => this.selectWeightedRandom(weights))

    this.fragmentBudget = rollWaveBudget(this.difficulty, this.currentWave)
    const drops = distributeFragments(
      this.fragmentBudget.enemies,
      [...regularTypes, ...bossTypes],
      typeId => EnemyRegistry[typeId]?.fragmentWeight ?? 1
    )

    this.plannedSpawns = regularTypes.map((typeId, i) => ({ typeId, fragments: drops[i] }))
    this.plannedBosses = bossTypes.map((typeId, i) => ({ typeId, fragments: drops[regularCount + i] }))
  }

  private spawnPlanned(spawn: PlannedSpawn): void {
    this.enemyManager.spawnEnemy(spawn.typeId, undefined, undefined, true, enemy => {
      enemy.fragments = spawn.fragments
    })
  }

  private spawnBossesDelayed(): void {
    this.scene.time.delayedCall(2000, () => {
      console.log(`Spawning boss for wave ${this.currentWave}`)
      for (const boss of this.plannedBosses) {
        this.spawnPlanned(boss)
      }
    })
  }

  private spawnEnemiesGradually(): void {
    const spawnDelay = this.difficulty.getSpawnDelay(this.currentWave)

    const spawnTimer = this.scene.time.addEvent({
      delay: spawnDelay,
      callback: () => {
        if (this.enemiesSpawned < this.totalEnemiesToSpawn) {
          this.spawnPlanned(this.plannedSpawns[this.enemiesSpawned])
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

    // Before waveValidation.completeWave, which resets the earned counts.
    this.logFragmentCheck()

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

    await GameManager.completeWave(this.fragmentBudget?.bonus ?? emptyFragments())

    this.currentWave++
    GameManager.setWave(this.currentWave)
    console.log(`Wave incremented to ${this.currentWave} after completion`)

    EventBus.emit('wave-start', this.currentWave)
    // Online persistence already happened above, inside waveValidation.completeWave().
  }

  /** Dev only: a full clear should pay out every fragment the enemies were given. */
  private logFragmentCheck(): void {
    if (!import.meta.env.DEV || !this.fragmentBudget || GameManager.getPlayerStats().isDead) return

    const expected = this.fragmentBudget.enemies
    const earned = waveValidation.getFragmentsEarned()
    if (FRAGMENT_TIERS.every(tier => earned[tier] === expected[tier])) {
      console.log(`[FRAGMENTS] Wave ${this.currentWave} paid out in full`, expected, 'bonus', this.fragmentBudget.bonus)
    } else {
      console.warn(`[FRAGMENTS] Wave ${this.currentWave} payout mismatch`, { expected, earned })
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