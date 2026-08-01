import axios from '../../config/axios'
import { GameManager } from '../core/GameManager'
import {
  UpgradeEntry,
  UpgradesSaveData,
  DeathFrozenState,
  GameStatsData,
  PointsData,
  PlayerStateData,
  FullGameSave,
  FullGameSaveBackend
} from './SaveTypes'

/**
 * SaveManager - local session state + full-game load
 *
 * All persistence to the backend now happens server-side, synchronously with
 * the action that earns it: wave-complete/death via wave_service.complete_wave
 * (online only - see WaveValidation.ts), upgrade purchases via
 * /api/waves/select-upgrade and /api/waves/reroll. This class now only:
 * - Tracks local session state (upgrade history for offline/sandbox mode,
 *   death-state snapshot for the death screen) used by LocalSaveManager for
 *   offline saves and by the UI for immediate display.
 * - Loads the full game save from the backend (`loadFullGame`) and applies it
 *   to GameManager (`restoreGameState`).
 */
class SaveManagerClass {
  // ========================================
  // STATE
  // ========================================

  /** Whether death state has been frozen this session */
  private deathStateFrozen: boolean = false

  /** Frozen death state (null if player hasn't died) */
  private deathState: DeathFrozenState | null = null

  /** Timestamp when game session started */
  private gameStartTime: number = 0

  /** Ordered list of upgrade purchases */
  private upgradeHistory: UpgradeEntry[] = []

  // ========================================
  // INITIALIZATION
  // ========================================

  /**
   * Initialize the save manager for a new game session.
   * Call this when starting a new game.
   */
  initialize(): void {
    this.deathStateFrozen = false
    this.deathState = null
    this.gameStartTime = Date.now()
    this.upgradeHistory = []
    console.log('[SaveManager] Initialized for new game session')
  }

  /**
   * Restore state from a loaded game.
   * Call this when continuing a saved game.
   */
  restoreFromLoad(upgradeHistory: UpgradeEntry[]): void {
    this.deathStateFrozen = false
    this.deathState = null
    this.gameStartTime = Date.now()
    this.upgradeHistory = [...upgradeHistory]
    console.log('[SaveManager] Restored from load with', upgradeHistory.length, 'upgrades')
  }

  // ========================================
  // UPGRADE TRACKING
  // ========================================

  /**
   * Record an upgrade purchase. Must be called when player buys an upgrade.
   * Maintains order for correct stat reconstruction on load.
   */
  recordUpgradePurchase(upgradeId: string, waveNumber: number): void {
    const entry: UpgradeEntry = {
      upgradeId,
      purchasedAt: Date.now(),
      waveNumber
    }
    this.upgradeHistory.push(entry)
    console.log('[SaveManager] Recorded upgrade purchase:', upgradeId, 'at wave', waveNumber)
  }

  /**
   * Get the current upgrade history (ordered by purchase time).
   */
  getUpgradeHistory(): UpgradesSaveData {
    return {
      purchaseHistory: [...this.upgradeHistory]
    }
  }

  /**
   * Get just the upgrade IDs in order (for compatibility with existing code).
   */
  getUpgradeIds(): string[] {
    return this.upgradeHistory.map(e => e.upgradeId)
  }

  // ========================================
  // DEATH STATE MANAGEMENT
  // ========================================

  /**
   * Freeze the game state at the moment of death.
   * Can only be called once per session. Subsequent calls return the cached state.
   */
  freezeDeathState(): DeathFrozenState | null {
    if (this.deathStateFrozen) {
      console.log('[SaveManager] Death state already frozen, returning cached')
      return this.deathState
    }

    const gameState = GameManager.getState()
    const stats = gameState.playerStats
    const timeSurvived = Math.floor((Date.now() - this.gameStartTime) / 1000)

    // Use GameManager's frozen death state if available (captures exact moment of death)
    // This prevents kills from projectiles in flight from being lost
    const gmDeathState = GameManager.getDeathState()

    this.deathState = {
      frozenAt: Date.now(),
      wavesCompleted: gmDeathState?.wave ?? gameState.wave, // Use frozen wave or current-1
      enemiesKilled: gmDeathState?.kills ?? stats.kills, // Use frozen kills or current
      timeSurvived,
      pointsAtDeath: stats.points
    }

    this.deathStateFrozen = true
    console.log('[SaveManager] Death state frozen:', this.deathState)
    return this.deathState
  }

  /**
   * Check if death state has been frozen.
   */
  isDeathStateFrozen(): boolean {
    return this.deathStateFrozen
  }

  /**
   * Get the frozen death state (null if player hasn't died).
   */
  getDeathState(): DeathFrozenState | null {
    return this.deathState
  }

  // ========================================
  // CURRENT STATE GETTERS
  // ========================================

  /**
   * Get current game statistics.
   */
  getCurrentGameStats(): GameStatsData {
    const gameState = GameManager.getState()
    const timeSurvived = Math.floor((Date.now() - this.gameStartTime) / 1000)

    return {
      currentWave: gameState.wave,
      currentKills: gameState.playerStats.kills,
      seed: gameState.seed,
      timeSurvived
    }
  }

  /**
   * Get current points.
   */
  getCurrentPoints(): PointsData {
    return {
      currentPoints: GameManager.getPlayerStats().points
    }
  }

  /**
   * Get current player state.
   */
  getCurrentPlayerState(): PlayerStateData {
    const stats = GameManager.getPlayerStats()
    return {
      currentHealth: stats.health,
      currentMaxHealth: stats.maxHealth,
      currentSpeed: stats.speed,
      currentPolygonSides: stats.polygonSides,
      unlockedAttacks: stats.unlockedAttacks
    }
  }

  // ========================================
  // LOAD OPERATIONS
  // ========================================

  /**
   * Load full game state from backend.
   * Returns null if no save exists or if player cannot continue (dead).
   */
  async loadFullGame(): Promise<FullGameSave | null> {
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        console.log('[SaveManager] No auth token')
        return null
      }

      const response = await axios.get<FullGameSaveBackend>('/api/saves/full', {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (!response.data) {
        console.log('[SaveManager] No save data found')
        return null
      }

      const data = response.data

      // Check if player can continue
      if (!data.can_continue) {
        console.log('[SaveManager] Save exists but cannot continue (game over)')
        return null
      }

      // Transform backend data to frontend format
      const fullSave: FullGameSave = {
        gameStats: {
          currentWave: data.game_stats.current_wave,
          currentKills: data.game_stats.current_kills,
          seed: data.game_stats.seed,
          timeSurvived: data.game_stats.time_survived
        },
        points: {
          currentPoints: data.points.current_points
        },
        upgrades: {
          purchaseHistory: data.upgrades.purchase_history.map(u => ({
            upgradeId: u.upgrade_id,
            purchasedAt: u.purchased_at,
            waveNumber: u.wave_number
          }))
        },
        playerState: {
          currentHealth: data.player_state.current_health,
          currentMaxHealth: data.player_state.current_max_health,
          currentSpeed: data.player_state.current_speed,
          currentPolygonSides: data.player_state.current_polygon_sides,
          unlockedAttacks: data.player_state.unlocked_attacks
        },
        deathState: data.death_state ? {
          frozenAt: data.death_state.frozen_at,
          wavesCompleted: data.death_state.waves_completed,
          enemiesKilled: data.death_state.enemies_killed,
          timeSurvived: data.death_state.time_survived,
          pointsAtDeath: data.death_state.points_at_death
        } : null,
        canContinue: data.can_continue,
        lastSavedAt: data.last_saved_at
      }

      console.log('[SaveManager] Loaded full game:', fullSave)
      return fullSave
    } catch (error) {
      console.error('[SaveManager] Failed to load full game:', error)
      return null
    }
  }

  /**
   * Check if user has a saved game that can be continued.
   */
  async hasSavedGame(): Promise<{ exists: boolean; wave?: number }> {
    try {
      const token = localStorage.getItem('token')
      if (!token) return { exists: false }

      const response = await axios.get<{ can_continue: boolean; current_wave?: number }>('/api/saves/validate-load', {
        headers: { Authorization: `Bearer ${token}` }
      })

      return {
        exists: response.data.can_continue,
        wave: response.data.current_wave
      }
    } catch (error) {
      console.error('[SaveManager] Failed to check saved game:', error)
      return { exists: false }
    }
  }

  /**
   * Restore game state from loaded save data.
   * Call this after loadFullGame() to apply the state to GameManager.
   */
  restoreGameState(savedData: FullGameSave): void {
    // Set the wave number
    GameManager.setWave(savedData.gameStats.currentWave)

    // Restore player stats
    GameManager.updatePlayerStats({
      health: savedData.playerState.currentHealth,
      maxHealth: savedData.playerState.currentMaxHealth,
      speed: savedData.playerState.currentSpeed,
      points: savedData.points.currentPoints,
      polygonSides: savedData.playerState.currentPolygonSides,
      kills: savedData.gameStats.currentKills,
      unlockedAttacks: savedData.playerState.unlockedAttacks,
      isDead: !savedData.canContinue
    })

    // Extract upgrade IDs from purchase history and store in GameManager
    const appliedUpgrades = savedData.upgrades.purchaseHistory.map(u => u.upgradeId)
    GameManager.setAppliedUpgrades(appliedUpgrades)
    GameManager.setSeed(savedData.gameStats.seed)

    // Initialize SaveManager with the loaded upgrade history
    this.restoreFromLoad(savedData.upgrades.purchaseHistory)

    console.log('[SaveManager] Game state restored:', GameManager.getState())
  }
}

// Export singleton instance
export const SaveManager = new SaveManagerClass()