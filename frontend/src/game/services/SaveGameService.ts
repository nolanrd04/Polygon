import axios from 'axios'
import { GameManager } from '../core/GameManager'

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
   * Load the saved game for the current user
   */
  static async loadSavedGame(): Promise<SavedGameData | null> {
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        console.error('No auth token found')
        return null
      }

      const response = await axios.get('/api/saves/', {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (response.data) {
        console.log('Loaded saved game:', response.data)
        return response.data
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
