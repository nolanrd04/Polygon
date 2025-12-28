import axios from '../../config/axios'
import { GameManager } from '../core/GameManager'
import {
  SaveCategory,
  SaveResult,
  SaveValidationError,
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
 * SaveManager - Modular Save System
 *
 * Handles saving different categories of game data independently:
 * - GameStats: Wave, kills, seed (frozen on death)
 * - Points: Currency (persists after death)
 * - Upgrades: Ordered purchase history (persists after death)
 * - DeathState: Frozen state at death (immutable once set)
 * - PlayerState: Health, speed, etc. (bundled with game stats)
 *
 * Key behaviors:
 * - Death state can only be frozen once per session
 * - Game stats saves are blocked after death
 * - Points and upgrades can be saved anytime
 */
class SaveManagerClass {
  // ========================================
  // STATE
  // ========================================

  /** Whether SaveManager has been initialized for this session */
  /** CRITICAL: Prevents saves with empty data before game is loaded */
  private isInitialized: boolean = false

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
    this.isInitialized = true
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
    this.isInitialized = true
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
  // INDIVIDUAL SAVE METHODS
  // ========================================

  /**
   * Save current points to backend.
   * Only allowed after death or when wave is not active.
   * BLOCKS mid-wave saves to prevent exploit of repeating waves for points.
   */
  async savePoints(): Promise<SaveResult> {
    const timestamp = Date.now()

    // GUARD: Block points save during active wave (prevents mid-wave point farming exploit)
    // Exception: Allow saving after death so points can be spent on upgrades
    const gameState = GameManager.getState()
    if (gameState.isWaveActive) {
      console.log('[SaveManager] Skipping points save - wave is active (prevents mid-wave exploit)')
      return {
        success: false,
        category: SaveCategory.POINTS,
        timestamp,
        error: SaveValidationError.WAVE_ACTIVE
      }
    }

    try {
      const token = localStorage.getItem('token')
      if (!token) {
        return {
          success: false,
          category: SaveCategory.POINTS,
          timestamp,
          error: SaveValidationError.NO_AUTH
        }
      }

      const points = this.getCurrentPoints()

      await axios.post('/api/saves/points', {
        current_points: points.currentPoints
      }, {
        headers: { Authorization: `Bearer ${token}` }
      })

      console.log('[SaveManager] Points saved:', points.currentPoints)
      return { success: true, category: SaveCategory.POINTS, timestamp }
    } catch (error: any) {
      console.error('[SaveManager] Failed to save points:', error)
      return {
        success: false,
        category: SaveCategory.POINTS,
        timestamp,
        error: error.message || SaveValidationError.BACKEND_ERROR
      }
    }
  }

  /**
   * Save upgrade history to backend.
   * Only allowed after death or when wave is not active.
   * BLOCKS mid-wave saves to prevent exploit of repeating waves for upgrades.
   */
  async saveUpgrades(): Promise<SaveResult> {
    const timestamp = Date.now()

    // GUARD: Block upgrades save during active wave (prevents mid-wave exploit)
    // Exception: Allow saving after death so purchased upgrades are preserved
    const gameState = GameManager.getState()
    if (gameState.isWaveActive && !this.deathStateFrozen) {
      console.log('[SaveManager] Skipping upgrades save - wave is active (prevents mid-wave exploit)')
      return {
        success: false,
        category: SaveCategory.UPGRADES,
        timestamp,
        error: SaveValidationError.WAVE_ACTIVE
      }
    }

    try {
      const token = localStorage.getItem('token')
      if (!token) {
        return {
          success: false,
          category: SaveCategory.UPGRADES,
          timestamp,
          error: SaveValidationError.NO_AUTH
        }
      }

      const upgrades = this.getUpgradeHistory()

      await axios.post('/api/saves/upgrades', {
        purchase_history: upgrades.purchaseHistory.map(u => ({
          upgrade_id: u.upgradeId,
          purchased_at: u.purchasedAt,
          wave_number: u.waveNumber
        }))
      }, {
        headers: { Authorization: `Bearer ${token}` }
      })

      console.log('[SaveManager] Upgrades saved:', upgrades.purchaseHistory.length, 'items')
      return { success: true, category: SaveCategory.UPGRADES, timestamp }
    } catch (error: any) {
      console.error('[SaveManager] Failed to save upgrades:', error)
      return {
        success: false,
        category: SaveCategory.UPGRADES,
        timestamp,
        error: error.message || SaveValidationError.BACKEND_ERROR
      }
    }
  }

  /**
   * Save game statistics to backend.
   * BLOCKED if player is dead (use frozen death state instead).
   */
  async saveGameStats(): Promise<SaveResult> {
    const timestamp = Date.now()

    // Guard: Block game stats save after death
    if (this.deathStateFrozen) {
      console.log('[SaveManager] Skipping game stats save - death state frozen')
      return {
        success: false,
        category: SaveCategory.GAME_STATS,
        timestamp,
        error: SaveValidationError.PLAYER_DEAD
      }
    }

    // Guard: Block save during active wave
    const gameState = GameManager.getState()
    if (gameState.isWaveActive) {
      console.log('[SaveManager] Skipping game stats save - wave is active')
      return {
        success: false,
        category: SaveCategory.GAME_STATS,
        timestamp,
        error: SaveValidationError.WAVE_ACTIVE
      }
    }

    try {
      const token = localStorage.getItem('token')
      if (!token) {
        return {
          success: false,
          category: SaveCategory.GAME_STATS,
          timestamp,
          error: SaveValidationError.NO_AUTH
        }
      }

      const gameStats = this.getCurrentGameStats()
      const playerState = this.getCurrentPlayerState()

      await axios.post('/api/saves/game-stats', {
        current_wave: gameStats.currentWave,
        current_kills: gameStats.currentKills,
        seed: gameStats.seed,
        time_survived: gameStats.timeSurvived,
        // Include player state with game stats
        current_health: playerState.currentHealth,
        current_max_health: playerState.currentMaxHealth,
        current_speed: playerState.currentSpeed,
        current_polygon_sides: playerState.currentPolygonSides,
        unlocked_attacks: playerState.unlockedAttacks
      }, {
        headers: { Authorization: `Bearer ${token}` }
      })

      console.log('[SaveManager] Game stats saved - Wave:', gameStats.currentWave, 'Kills:', gameStats.currentKills)
      return { success: true, category: SaveCategory.GAME_STATS, timestamp }
    } catch (error: any) {
      console.error('[SaveManager] Failed to save game stats:', error)
      return {
        success: false,
        category: SaveCategory.GAME_STATS,
        timestamp,
        error: error.message || SaveValidationError.BACKEND_ERROR
      }
    }
  }

  /**
   * Save death state to backend.
   * Can only be called once per game (rejected if death state already exists).
   */
  async saveDeathState(): Promise<SaveResult> {
    const timestamp = Date.now()

    if (!this.deathState) {
      return {
        success: false,
        category: SaveCategory.DEATH_STATE,
        timestamp,
        error: 'No death state to save'
      }
    }

    try {
      const token = localStorage.getItem('token')
      if (!token) {
        return {
          success: false,
          category: SaveCategory.DEATH_STATE,
          timestamp,
          error: SaveValidationError.NO_AUTH
        }
      }

      await axios.post('/api/saves/death-state', {
        frozen_at: this.deathState.frozenAt,
        waves_completed: this.deathState.wavesCompleted,
        enemies_killed: this.deathState.enemiesKilled,
        time_survived: this.deathState.timeSurvived,
        points_at_death: this.deathState.pointsAtDeath
      }, {
        headers: { Authorization: `Bearer ${token}` }
      })

      console.log('[SaveManager] Death state saved:', this.deathState)
      return { success: true, category: SaveCategory.DEATH_STATE, timestamp }
    } catch (error: any) {
      console.error('[SaveManager] Failed to save death state:', error)
      return {
        success: false,
        category: SaveCategory.DEATH_STATE,
        timestamp,
        error: error.message || SaveValidationError.BACKEND_ERROR
      }
    }
  }

  // ========================================
  // COMPOSITE SAVE OPERATIONS
  // ========================================

  /**
   * Save on wave completion.
   * Saves: GameStats + Points + Upgrades (if player is alive)
   */
  async saveOnWaveComplete(): Promise<SaveResult[]> {
    // GUARD: Don't save if not initialized (prevents overwriting during load)
    if (!this.isInitialized) {
      console.log('[SaveManager] Skipping wave complete save - not initialized yet')
      return []
    }

    if (this.deathStateFrozen) {
      console.log('[SaveManager] Skipping wave complete save - player is dead')
      return []
    }

    console.log('[SaveManager] Saving on wave complete...')
    const results: SaveResult[] = []

    // Save all categories in parallel
    const [gameStatsResult, pointsResult, upgradesResult] = await Promise.all([
      this.saveGameStats(),
      this.savePoints(),
      this.saveUpgrades()
    ])

    results.push(gameStatsResult, pointsResult, upgradesResult)
    return results
  }

  /**
   * Save on player death.
   * Saves: DeathState + Points + Upgrades
   */
  async saveOnDeath(): Promise<SaveResult[]> {
    // GUARD: Don't save if not initialized (prevents overwriting during load)
    if (!this.isInitialized) {
      console.log('[SaveManager] Skipping death save - not initialized yet')
      return []
    }

    // Freeze the death state first
    this.freezeDeathState()

    console.log('[SaveManager] Saving on death...')
    const results: SaveResult[] = []

    // Save all categories in parallel
    const [deathStateResult, pointsResult, upgradesResult] = await Promise.all([
      this.saveDeathState(),
      this.savePoints(),
      this.saveUpgrades()
    ])

    results.push(deathStateResult, pointsResult, upgradesResult)
    return results
  }

  /**
   * Save on upgrade purchase.
   * Saves: Points + Upgrades
   */
  async saveOnUpgradePurchase(): Promise<SaveResult[]> {
    // GUARD: Don't save if not initialized (prevents overwriting during load)
    if (!this.isInitialized) {
      console.log('[SaveManager] Skipping upgrade purchase save - not initialized yet')
      return []
    }

    console.log('[SaveManager] Saving on upgrade purchase...')
    const results: SaveResult[] = []

    // Save in parallel
    const [pointsResult, upgradesResult] = await Promise.all([
      this.savePoints(),
      this.saveUpgrades()
    ])

    results.push(pointsResult, upgradesResult)
    return results
  }

  /**
   * Save on quit.
   * Saves appropriate data based on death state:
   * - If alive: GameStats + Points + Upgrades
   * - If dead: Points + Upgrades only
   */
  async saveOnQuit(): Promise<SaveResult[]> {
    // GUARD: Don't save if not initialized (prevents overwriting during load)
    if (!this.isInitialized) {
      console.log('[SaveManager] Skipping quit save - not initialized yet')
      return []
    }

    console.log('[SaveManager] Saving on quit...')

    if (this.deathStateFrozen) {
      // Player is dead - only save points and upgrades
      const [pointsResult, upgradesResult] = await Promise.all([
        this.savePoints(),
        this.saveUpgrades()
      ])
      return [pointsResult, upgradesResult]
    } else {
      // Player is alive - save everything
      return this.saveOnWaveComplete()
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