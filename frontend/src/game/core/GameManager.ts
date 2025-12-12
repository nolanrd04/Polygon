import { EventBus } from './EventBus'
import { Projectile } from '../entities/projectiles/Projectile'

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
}

/**
 * GameState Interface
 * Represents the complete state of the game session
 */
export interface GameState {
  wave: number // Current wave number (starts at 0, increments with each wave)
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
      unlockedAttacks: ['bullet']
    },
    appliedUpgrades: []
  }

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
   */
  takeDamage(amount: number): void {
    const newHealth = Math.max(0, this.state.playerStats.health - amount)
    this.state.playerStats = {
      ...this.state.playerStats,
      health: newHealth
    }
    EventBus.emit('player-stats-update', this.state.playerStats)

    // Trigger game over if health depleted
    if (newHealth <= 0) {
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
   * Complete the current wave
   * Calculates score (doubled for prime number waves), awards points, and shows completion screen
   */
  completeWave(): void {
    this.state.isWaveActive = false
    // Base wave bonus of 10, scaled exponentially: 10 * e^(wave/8)
    const baseBonus = 15
    // const waveMultiplier = Math.exp((this.state.wave - 1) / 16)
    // const score = Math.floor(baseBonus * waveMultiplier)
    const score = Math.min(55, Math.floor(baseBonus + (this.state.wave) * 2))

    this.addPoints(score)
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
      wave: 0,
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
        unlockedAttacks: ['bullet']
      },
      appliedUpgrades: []
    }

    // Clear entity tracking
    this.projectiles.clear()
    this.nextProjectileId = 1
  }

  /**
   * Increment kill counter
   * Called when an enemy is killed by the player
   */
  addKill(): void {
    this.state.playerStats = {
      ...this.state.playerStats,
      kills: this.state.playerStats.kills + 1
    }
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
