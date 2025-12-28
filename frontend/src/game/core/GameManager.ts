import { EventBus } from './EventBus'
import { Projectile } from '../entities/projectiles/Projectile'
import { SaveManager } from '../services/SaveManager'

/**
 * PlayerStats Interface
 * Defines all stats tracked for the player character
 */
export interface PlayerStats {
  health: number // Current health points
  maxHealth: number // Maximum health capacity
  speed: number // Movement speed in pixels per second
  points: number // Score/currency earned from killing enemies
  kills: number // Total enemies killed
  polygonSides: number // Number of sides on player's polygon shape (affects max unlocked attacks)
  unlockedAttacks: string[] // Attack types the player has unlocked
  isDead: boolean // Flag that is set when player dies and stays set (prevents continue after healing)
}

/**
 * GameState Interface
 * Represents the complete state of the game session
 */
export interface GameState {
  wave: number // Current wave number (starts at 1, increments after completing each wave)
  isPaused: boolean // Whether game is currently paused
  isWaveActive: boolean // Whether a wave is currently in progress
  seed: number // Random seed for procedural generation
  playerStats: PlayerStats // All player statistics
  appliedUpgrades: string[] // IDs of upgrades the player has selected
  projectiles?: any[] // (Optional) Currently active projectiles in the game
  enemies?: any[] // (Optional) Currently active enemies in the game
  bosses?: any[] // (Optional) Currently active bosses in the game
}

/**
 * GameManagerClass
 * Central singleton that manages all game state and coordinates between systems.
 * Handles player stats, wave progression, damage/healing, and upgrade application.
 * Communicates state changes via the EventBus to keep UI and game systems in sync.
 */
class GameManagerClass {
  // Initialize with default starting state
  private state: GameState = {
    wave: 1,
    isPaused: false,
    isWaveActive: false,
    seed: Date.now(),
    playerStats: {
      health: 100,
      maxHealth: 100,
      speed: 200,
      points: 0,
      kills: 0,
      polygonSides: 3,
      unlockedAttacks: ['bullet'],
      isDead: false
    },
    appliedUpgrades: []
  }

  // Flag to track if player has died this session (prevents overwriting death save)
  private hasPlayerDied: boolean = false

  // Death state - frozen values captured at moment of death
  // UI shows current wave, but backend saves use these frozen values
  private deathWave: number | null = null
  private deathKills: number | null = null

  // ============================================================
  // ENTITY TRACKING - Projectiles, Enemies, and Bosses
  // ============================================================

  /** Map of all active projectiles by their ID */
  private projectiles: Map<number, Projectile> = new Map()

  /** Auto-incrementing ID counter for projectiles */
  private nextProjectileId: number = 1

  /**
   * Get a copy of the current game state
   * Returns a shallow copy to prevent external mutation
   */
  getState(): GameState {
    return { ...this.state }
  }

  /**
   * Get a copy of current player stats
   * Returns a shallow copy to prevent external mutation
   */
  getPlayerStats(): PlayerStats {
    return { ...this.state.playerStats }
  }

  /**
   * Update player stats with partial updates
   * Merges provided updates with existing stats and emits update event
   */
  updatePlayerStats(updates: Partial<PlayerStats>): void {
    this.state.playerStats = { ...this.state.playerStats, ...updates }
    EventBus.emit('player-stats-update', this.state.playerStats)
  }

  /**
   * Award points to the player (earned from killing enemies)
   * Points are used as currency for upgrades
   * NOTE: Points continue to accumulate after death for testing/fun
   */
  addPoints(points: number): void {
    this.state.playerStats = {
      ...this.state.playerStats,
      points: this.state.playerStats.points + points
    }
    EventBus.emit('player-stats-update', this.state.playerStats)
  }

  /**
   * Apply damage to the player
   * Clamps health to minimum of 0 and emits player-death event if health reaches 0
   * Sets isDead flag permanently when player dies (prevents continue after healing)
   */
  takeDamage(amount: number): void {
    const currentHealth = this.state.playerStats.health
    const newHealth = Math.max(0, currentHealth - amount)

    console.log(`[DEBUG] takeDamage: ${currentHealth} - ${amount} = ${newHealth}`)

    this.state.playerStats = {
      ...this.state.playerStats,
      health: newHealth
    }
    EventBus.emit('player-stats-update', this.state.playerStats)

    // Trigger game over if health depleted
    if (newHealth <= 0 && !this.hasPlayerDied) {
      console.log('[DEBUG] HEALTH REACHED 0 - Setting death flag and emitting player-death')

      // CRITICAL: Freeze death state in SaveManager FIRST before anything else
      // This ensures the exact moment of death is captured
      SaveManager.freezeDeathState()

      this.hasPlayerDied = true

      // Capture death state (frozen values for backend saves)
      this.deathWave = this.state.wave
      this.deathKills = this.state.playerStats.kills
      console.log(`[DEATH STATE CAPTURED] Wave: ${this.deathWave}, Kills: ${this.deathKills}`)

      // Set isDead flag in player stats (persists through save/load)
      this.state.playerStats = {
        ...this.state.playerStats,
        isDead: true
      }
      EventBus.emit('player-death')
    }
  }

  /**
   * Heal the player by specified amount
   * Clamps health to not exceed maxHealth
   */
  heal(amount: number): void {
    this.state.playerStats = {
      ...this.state.playerStats,
      health: Math.min(
        this.state.playerStats.maxHealth,
        this.state.playerStats.health + amount
      )
    }
    EventBus.emit('player-stats-update', this.state.playerStats)
  }

  /**
   * Start a new wave
   * Marks wave as active (wave counter is managed by WaveManager)
   */
  startWave(): void {
    this.state.isWaveActive = true
    EventBus.emit('wave-start', this.state.wave)
  }

  /**
   * Set the current wave number (called by WaveManager to sync wave counter)
   */
  setWave(wave: number): void {
    this.state.wave = wave
  }

  /**
   * Restore applied upgrades from saved game
   * Replaces the entire appliedUpgrades array
   */
  setAppliedUpgrades(upgrades: string[]): void {
    this.state.appliedUpgrades = upgrades
    console.log('GameManager.setAppliedUpgrades:', upgrades.length, 'upgrades')
  }

  /**
   * Set the random seed (for save/load)
   */
  setSeed(seed: number): void {
    this.state.seed = seed
  }

  /**
   * Complete the current wave
   * Calculates score (doubled for prime number waves), awards points, and shows completion screen
   * NOTE: If player is dead, wave completion is allowed but NOT saved
   */
  async completeWave(): Promise<void> {
    this.state.isWaveActive = false
    // Base wave bonus of 10, scaled exponentially: 10 * e^(wave/8)
    const baseBonus = 25
    // const waveMultiplier = Math.exp((this.state.wave - 1) / 16)
    // const score = Math.floor(baseBonus * waveMultiplier)
    const score = Math.min(55, Math.floor(baseBonus + (this.state.wave) * 2))

    this.addPoints(score)

    // GUARD: Don't save wave completion if player is dead
    // Player can keep playing for fun, but wave progress won't be saved
    if (!this.state.playerStats.isDead) {
      // Save the current wave completion to backend
      // Wave will be incremented by WaveManager after this returns
      const { SaveManager } = await import('../services/SaveManager')
      await SaveManager.saveOnWaveComplete()
      console.log(`Saved game state after wave ${this.state.wave} completion, current wave: ${this.state.wave}, points: ${this.state.playerStats.points}`)
    } else {
      console.log(`[DEATH MODE] Wave ${this.state.wave} completed but NOT saved (player is dead)`)
    }

    // Pre-load upgrades for NEXT wave (WaveManager will increment wave after this)
    // So we pre-load for current wave + 1
    const nextWave = this.state.wave + 1
    const seed = Math.floor(Math.random() * 1000000)
    const { waveValidation } = await import('../services/WaveValidation')
    await waveValidation.startWave(nextWave, seed)
    console.log(`Pre-loaded upgrades for wave ${nextWave}`)

    EventBus.emit('wave-complete', {
      wave: this.state.wave,
      score,
      isPrime: false
    })
  }

  /**
   * Check if a number is prime
   * Used to determine if current wave number qualifies for score bonus
   */
  // private _isPrimeNumber(num: number): boolean {
  //   if (num < 2) return false
  //   for (let i = 2; i <= Math.sqrt(num); i++) {
  //     if (num % i === 0) return false
  //   }
  //   return true
  // }

  /**
   * Apply an upgrade to the player
   * Tracks the upgrade ID and applies any stat modifications
   * Note: Most upgrade effects are handled by UpgradeEffectSystem, this handles simple stat boosts
   */
  applyUpgrade(upgradeId: string, effects: Record<string, unknown>): void {
    this.state.appliedUpgrades.push(upgradeId)

    // Handle simple stat upgrades (e.g., +10 max health)
    if (effects.stat && effects.value) {
      const stat = effects.stat as keyof PlayerStats
      const value = effects.value as number

      if (stat in this.state.playerStats && typeof this.state.playerStats[stat] === 'number') {
        (this.state.playerStats[stat] as number) += value
      }
    }

    EventBus.emit('player-stats-update', this.state.playerStats)
  }

  /**
   * Pause the game
   * Freezes game time and shows pause menu
   */
  pause(): void {
    this.state.isPaused = true
    EventBus.emit('game-pause')
  }

  /**
   * Resume the game from pause
   * Unfreezes game time
   */
  resume(): void {
    this.state.isPaused = false
    EventBus.emit('game-resume')
  }

  /**
   * Reset game to initial state
   * Called when starting a new game session
   */
  reset(): void {
    this.state = {
      wave: 1,
      isPaused: false,
      isWaveActive: false,
      seed: Date.now(),
      playerStats: {
        health: 100,
        maxHealth: 100,
        speed: 200,
        points: 0,
        kills: 0,
        polygonSides: 3,
        unlockedAttacks: ['bullet'],
        isDead: false
      },
      appliedUpgrades: []
    }

    // Clear entity tracking
    this.projectiles.clear()
    this.nextProjectileId = 1

    // Reset death state
    this.hasPlayerDied = false
    this.deathWave = null
    this.deathKills = null

    // Initialize SaveManager for new game session
    SaveManager.initialize()
  }

  /**
   * Check if player has died this session
   */
  hasPlayerDiedThisSession(): boolean {
    return this.hasPlayerDied
  }

  /**
   * Get frozen death state (wave and kills at moment of death)
   * Returns null if player hasn't died
   */
  getDeathState(): { wave: number; kills: number } | null {
    if (this.deathWave === null || this.deathKills === null) {
      return null
    }
    return {
      wave: this.deathWave,
      kills: this.deathKills
    }
  }

  /**
   * Increment kill counter
   * Called when an enemy is killed by the player
   */
  addKill(): void {
    // GUARD: Prevent kill tracking after death
    if (this.state.playerStats.isDead) {
      console.log('[GameManager] Blocked addKill() - player is dead')
      return
    }

    this.state.playerStats = {
      ...this.state.playerStats,
      kills: this.state.playerStats.kills + 1
    }
    // console.log(`[GameManager] Kill count: ${this.state.playerStats.kills}`)
    EventBus.emit('player-stats-update', this.state.playerStats)
  }

  // ============================================================
  // PROJECTILE MANAGEMENT
  // ============================================================

  /**
   * Generate a unique ID for a new projectile.
   * Call this before spawning a projectile to assign it an ID.
   * @returns A unique projectile ID
   */
  generateProjectileId(): number {
    return this.nextProjectileId++
  }

  /**
   * Register a projectile with the GameManager.
   * Should be called after spawning a projectile.
   * @param projectile The projectile instance to track
   */
  addProjectile(projectile: Projectile): void {
    this.projectiles.set(projectile.id, projectile)
  }

  /**
   * Remove a projectile from tracking.
   * Should be called when a projectile is destroyed.
   * @param id The ID of the projectile to remove
   */
  removeProjectile(id: number): void {
    this.projectiles.delete(id)
  }

  /**
   * Get a specific projectile by its ID.
   * O(1) constant-time lookup.
   * @param id The projectile ID to look up
   * @returns The projectile instance, or undefined if not found
   */
  getProjectile(id: number): Projectile | undefined {
    return this.projectiles.get(id)
  }

  /**
   * Get all active projectiles as an array.
   * @returns Array of all tracked projectiles
   */
  getAllProjectiles(): Projectile[] {
    return Array.from(this.projectiles.values())
  }

  /**
   * Get the count of active projectiles.
   * @returns Number of projectiles currently tracked
   */
  getProjectileCount(): number {
    return this.projectiles.size
  }

  /**
   * Check if a projectile with the given ID exists.
   * @param id The projectile ID to check
   * @returns True if the projectile exists
   */
  hasProjectile(id: number): boolean {
    return this.projectiles.has(id)
  }
}

export const GameManager = new GameManagerClass()
