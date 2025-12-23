import axios from 'axios'
import { GameManager } from '../core/GameManager'

// Backend response format
export interface BackendSaveData {
  current_wave: number
  current_points: number
  seed: number
  current_health: number
  current_max_health: number
  current_speed: number
  current_polygon_sides: number
  current_upgrades: string[]
  current_kills: number
  attack_stats: Record<string, any>
  unlocked_attacks: string[]
  game_over?: boolean
}

// Frontend game format
export interface SavedGameData {
  wave: number
  points: number
  seed: number
  player_stats: {
    health: number
    maxHealth: number
    speed: number
    polygonSides: number
  }
  applied_upgrades: string[]
  kills: number
  attack_stats: Record<string, any>
  unlocked_attacks: string[]
  game_over?: boolean
}

export class SaveGameService {
  /**
   * Transform backend save data to frontend format
   */
  private static transformBackendData(backendData: BackendSaveData): SavedGameData {
    return {
      wave: backendData.current_wave,
      points: backendData.current_points,
      seed: backendData.seed,
      player_stats: {
        health: backendData.current_health,
        maxHealth: backendData.current_max_health,
        speed: backendData.current_speed,
        polygonSides: backendData.current_polygon_sides
      },
      applied_upgrades: backendData.current_upgrades,
      kills: backendData.current_kills || 0,
      attack_stats: backendData.attack_stats,
      unlocked_attacks: backendData.unlocked_attacks,
      game_over: backendData.game_over || false
    }
  }

  /**
   * Load the saved game for the current user
   */
  static async loadSavedGame(): Promise<SavedGameData | null> {
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        console.error('No auth token found')
        return null
      }

      // First, validate that the save can be loaded (not marked as game over)
      // This prevents exploits where stale client state allows loading dead runs
      try {
        const validationResponse = await axios.get<{ can_load: boolean; reason?: string }>('/api/saves/validate-load', {
          headers: { Authorization: `Bearer ${token}` }
        })

        if (!validationResponse.data.can_load) {
          console.log('[LOAD] Backend validation failed:', validationResponse.data.reason)
          return null
        }
      } catch (validationError) {
        console.error('Failed to validate save load:', validationError)
        return null
      }

      const response = await axios.get<BackendSaveData | null>('/api/saves/', {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (response.data) {
        console.log('Loaded saved game:', response.data)
        console.log('→ Points from database:', response.data.current_points, ', Wave:', response.data.current_wave)
        return this.transformBackendData(response.data)
      }

      return null
    } catch (error) {
      console.error('Failed to load saved game:', error)
      return null
    }
  }

  /**
   * Restore game state from saved data
   */
  static restoreGameState(savedData: SavedGameData): void {
    // Set the wave number
    GameManager.setWave(savedData.wave)

    // Restore player stats (including kills)
    GameManager.updatePlayerStats({
      health: savedData.player_stats.health,
      maxHealth: savedData.player_stats.maxHealth,
      speed: savedData.player_stats.speed,
      points: savedData.points,
      polygonSides: savedData.player_stats.polygonSides,
      kills: savedData.kills || 0,
      unlockedAttacks: savedData.unlocked_attacks
    })

    // Store applied upgrades and seed in GameManager
    console.log('DEBUG: savedData.applied_upgrades =', savedData.applied_upgrades)
    GameManager.setAppliedUpgrades(savedData.applied_upgrades)
    GameManager.setSeed(savedData.seed)

    console.log('Game state restored:', GameManager.getState())
    console.log('DEBUG: Verified currentState.appliedUpgrades after restore =', GameManager.getState().appliedUpgrades)
  }

  /**
   * Check if user has a saved game
   */
  static async hasSavedGame(): Promise<{ exists: boolean; wave?: number }> {
    const savedData = await this.loadSavedGame()
    return {
      exists: !!savedData,
      wave: savedData?.wave
    }
  }

  /**
   * Save current game state to backend
   * @param allowMidWave - If true, allows saving during active wave (for death saves)
   * @param isGameOver - If true, marks the save as game over (death, run ended)
   */
  static async saveCurrentGameState(allowMidWave: boolean = false, isGameOver: boolean = false): Promise<boolean> {
    try {
      const token = localStorage.getItem('token')
      if (!token) return false

      const gameState = GameManager.getState()

      // Don't save if we have no valid state
      if (!gameState || !gameState.playerStats) {
        console.log('Skipping save - no valid game state')
        return false
      }

      const stats = gameState.playerStats

      // Don't save if game hasn't been initialized yet
      if (!gameState.wave || gameState.wave === 0) {
        console.log('Skipping save - game not initialized yet (wave:', gameState.wave, ')')
        return false
      }

      // Don't save mid-wave to prevent exploit (replaying same wave for easy points)
      // Exception: Allow saving on death even if wave is active
      if (gameState.isWaveActive && !allowMidWave) {
        console.log('Skipping save - wave is active (prevents mid-wave save exploit)')
        return false
      }

      console.log('Saving game state with points:', stats.points, allowMidWave ? '(death save)' : '', isGameOver ? '[GAME OVER]' : '')

      await axios.post('/api/saves/', {
        current_wave: gameState.wave,
        current_points: stats.points,
        seed: gameState.seed,
        current_health: stats.health,
        current_max_health: stats.maxHealth,
        current_speed: stats.speed,
        current_polygon_sides: stats.polygonSides,
        current_kills: stats.kills,
        current_damage_dealt: 0,
        current_upgrades: gameState.appliedUpgrades,
        offered_upgrades: [],
        attack_stats: {
          bullet: {
            damage: 10,
            speed: 400,
            cooldown: 200,
            size: 1,
            pierce: 0
          }
        },
        unlocked_attacks: stats.unlockedAttacks || ['bullet'],
        game_over: isGameOver
      }, {
        headers: { Authorization: `Bearer ${token}` }
      })

      console.log('Game state saved successfully')
      return true
    } catch (error) {
      console.error('Failed to save game state:', error)
      return false
    }
  }
}
