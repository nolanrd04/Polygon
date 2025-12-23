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
  attack_stats: Record<string, any>
  unlocked_attacks: string[]
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
  attack_stats: Record<string, any>
  unlocked_attacks: string[]
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
      attack_stats: backendData.attack_stats,
      unlocked_attacks: backendData.unlocked_attacks
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

    // Restore player stats
    GameManager.updatePlayerStats({
      health: savedData.player_stats.health,
      maxHealth: savedData.player_stats.maxHealth,
      speed: savedData.player_stats.speed,
      points: savedData.points,
      polygonSides: savedData.player_stats.polygonSides,
      unlockedAttacks: savedData.unlocked_attacks
    })

    // Store applied upgrades in GameManager
    const currentState = GameManager.getState()
    currentState.appliedUpgrades = savedData.applied_upgrades
    currentState.seed = savedData.seed

    console.log('Game state restored:', currentState)
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
}
