import axios from '../../config/axios'
import { GameManager } from '../core/GameManager'
import statUpgrades from '../data/upgrades/stat_upgrades.json'
import effectUpgrades from '../data/upgrades/effect_upgrades.json'
import variantUpgrades from '../data/upgrades/variant_upgrades.json'
import abilityUpgrades from '../data/upgrades/ability_upgrades.json'

export interface FrameSample {
  frame: number
  timestamp: number
  player: {
    x: number
    y: number
    vx: number
    vy: number
    health: number
  }
}

export interface EnemyDeath {
  type: string
  x: number
  y: number
  frame: number
}

export class WaveValidationService {
  private waveToken: string | null = null
  private waveStartTime: number = 0
  private frameCount: number = 0
  private frameSamples: FrameSample[] = []
  private enemyDeaths: EnemyDeath[] = []
  private totalKills: number = 0
  private totalDamage: number = 0
  private damageTaken: number = 0
  private offeredUpgrades: any[] = []

  /**
   * Start a new wave - get token and upgrades from backend
   */
  async startWave(waveNumber: number, seed: number): Promise<any[] | null> {
    // GUARD: Don't sync wave start with backend after death
    // Player can keep playing locally but won't get fresh upgrades from backend
    if (GameManager.getPlayerStats().isDead) {
      console.log('[WAVE VALIDATION] Skipping wave start sync - player is dead (sandbox mode)')
      // Reset local state for sandbox play
      this.waveStartTime = Date.now()
      this.frameCount = 0
      this.frameSamples = []
      this.enemyDeaths = []
      this.totalKills = 0
      this.totalDamage = 0
      this.damageTaken = 0
      return this.offeredUpgrades // Return cached upgrades for sandbox play
    }

    try {
      const token = localStorage.getItem('token')
      if (!token) {
        console.error('No auth token found')
        return null
      }

      const response = await axios.post('/api/waves/start', {
        wave_number: waveNumber,
        seed: seed
      }, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      console.log('Full response.data from backend:', response.data)

      this.waveToken = response.data.token
      this.offeredUpgrades = response.data.offered_upgrades
      this.waveStartTime = Date.now()
      this.frameCount = 0
      this.frameSamples = []
      this.enemyDeaths = []
      this.totalKills = 0
      this.totalDamage = 0
      this.damageTaken = 0

      console.log(`Wave ${waveNumber} started. Token expires in ${response.data.expires_in}s`)
      console.log('Stored offeredUpgrades:', this.offeredUpgrades)
      console.log('Type of first upgrade:', typeof this.offeredUpgrades[0])

      return this.offeredUpgrades
    } catch (error) {
      console.error('Failed to start wave:', error)
      return null
    }
  }

  /**
   * Sample current frame data (call every 30-60 frames)
   */
  sampleFrame(playerX: number, playerY: number, playerVX: number, playerVY: number, playerHealth: number) {
    const sample: FrameSample = {
      frame: this.frameCount,
      timestamp: Date.now() - this.waveStartTime,
      player: {
        x: Math.round(playerX),
        y: Math.round(playerY),
        vx: Math.round(playerVX * 10) / 10,
        vy: Math.round(playerVY * 10) / 10,
        health: playerHealth
      }
    }

    this.frameSamples.push(sample)

    // Limit frame samples to prevent excessive data
    if (this.frameSamples.length > 200) {
      // Keep every other sample
      this.frameSamples = this.frameSamples.filter((_, i) => i % 2 === 0)
    }
  }

  /**
   * Record an enemy death
   */
  recordEnemyDeath(enemyType: string, x: number, y: number) {
    // GUARD: Don't track wave stats after death
    if (GameManager.getPlayerStats().isDead) {
      return
    }

    this.enemyDeaths.push({
      type: enemyType.toLowerCase(),
      x: Math.round(x),
      y: Math.round(y),
      frame: this.frameCount
    })
    this.totalKills++
  }

  /**
   * Record damage dealt
   */
  recordDamage(damage: number) {
    // GUARD: Don't track wave stats after death
    if (GameManager.getPlayerStats().isDead) {
      return
    }

    this.totalDamage += Math.round(damage)
  }

  /**
   * Record damage taken by player
   */
  recordDamageTaken(damage: number) {
    // GUARD: Don't track wave stats after death
    if (GameManager.getPlayerStats().isDead) {
      return
    }

    this.damageTaken += Math.round(damage)
  }

  /**
   * Increment frame counter
   */
  incrementFrame() {
    this.frameCount++
  }

  /**
   * Complete wave and submit to backend for validation
   */
  async completeWave(waveNumber: number): Promise<{ success: boolean; errors?: string[] }> {
    // GUARD: Don't submit wave completion to backend after death
    // Player can keep playing for fun, but stats won't be saved
    if (GameManager.getPlayerStats().isDead) {
      console.log('[WAVE VALIDATION] Skipping wave completion - player is dead (sandbox mode)')
      return { success: true } // Return success to not block game flow
    }

    if (!this.waveToken) {
      console.error('No wave token - wave was not started properly')
      return { success: false, errors: ['No wave token'] }
    }

    try {
      const token = localStorage.getItem('token')
      if (!token) {
        console.error('No auth token found')
        return { success: false, errors: ['Not authenticated'] }
      }

      // Get currently applied upgrades (including duplicates for stackable upgrades)
      const appliedUpgrades = GameManager.getState().appliedUpgrades

      // Get current player health
      const currentHealth = GameManager.getState().playerStats.health

      const response = await axios.post('/api/waves/complete', {
        token: this.waveToken,
        wave: waveNumber,
        kills: this.totalKills,
        total_damage: this.totalDamage,
        current_health: currentHealth,
        damage_taken: this.damageTaken,
        frame_samples: this.frameSamples,
        enemy_deaths: this.enemyDeaths,
        upgrades_used: appliedUpgrades
      }, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.data.success) {
        console.log(`Wave ${waveNumber} completed and validated`)
        return { success: true }
      } else {
        console.warn('Wave validation failed:', response.data.errors)
        return { success: false, errors: response.data.errors }
      }
    } catch (error: any) {
      console.error('Failed to complete wave:', error)
      return {
        success: false,
        errors: [error.response?.data?.detail || 'Network error']
      }
    } finally {
      // Reset for next wave
      this.waveToken = null
    }
  }

  /**
   * Select an upgrade (validates with backend)
   * Returns the new points value from backend (authoritative)
   */
  async selectUpgrade(upgradeId: string, waveNumber: number): Promise<{success: boolean, newPoints?: number}> {
    // GUARD: Don't sync upgrades with backend after death
    // Player can still apply upgrades locally for fun, but deduct points locally
    if (GameManager.getPlayerStats().isDead) {
      console.log('[WAVE VALIDATION] Player is dead - applying upgrade locally (sandbox mode)')

      // Find the upgrade cost
      const allUpgrades = [
        ...statUpgrades.upgrades,
        ...effectUpgrades.upgrades,
        ...variantUpgrades.upgrades,
        ...abilityUpgrades.upgrades
      ]
      const upgrade = allUpgrades.find((u: any) => u.id === upgradeId)
      const cost = upgrade?.cost || 0

      // Deduct points locally
      const stats = GameManager.getPlayerStats()
      const newPoints = stats.points - cost
      GameManager.updatePlayerStats({ points: newPoints })

      console.log(`[WAVE VALIDATION] Local upgrade purchase: ${upgradeId}, cost: ${cost}, new points: ${newPoints}`)
      return { success: true, newPoints }
    }

    try {
      const token = localStorage.getItem('token')
      if (!token) {
        console.error('No auth token found')
        return {success: false}
      }

      const response = await axios.post('/api/waves/select-upgrade', {
        upgrade_id: upgradeId,
        wave: waveNumber
      }, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.data.success) {
        console.log(`Upgrade ${upgradeId} applied and validated, new points: ${response.data.current_points}`)
        return {
          success: true,
          newPoints: response.data.current_points
        }
      }

      return {success: false}
    } catch (error: any) {
      console.error('Failed to select upgrade:', error)
      return {success: false}
    }
  }

  /**
   * Get offered upgrades for this wave
   */
  getOfferedUpgrades(): any[] {
    console.log('WaveValidation.getOfferedUpgrades() called, returning:', this.offeredUpgrades)
    return this.offeredUpgrades
  }

  /**
   * Reroll upgrades for the current wave
   */
  async rerollUpgrades(wave: number, rerollCost: number): Promise<{ upgrades: any[], newPoints: number } | null> {
    // After death, allow local rerolls (player can still spend points for fun)
    if (GameManager.getPlayerStats().isDead) {
      console.log('[WAVE VALIDATION] Player is dead - using local reroll (sandbox mode)')
      // Deduct points locally
      const stats = GameManager.getPlayerStats()
      const newPoints = stats.points - rerollCost
      if (newPoints < 0) {
        console.log('[WAVE VALIDATION] Not enough points for reroll')
        return null
      }
      GameManager.updatePlayerStats({ points: newPoints })

      // Generate random upgrades from full upgrade pool
      const allUpgrades = [
        ...statUpgrades.upgrades,
        ...effectUpgrades.upgrades,
        ...variantUpgrades.upgrades,
        ...abilityUpgrades.upgrades
      ]

      // Get current state for filtering
      const currentUpgrades = GameManager.getState().appliedUpgrades
      const currentAttackType = GameManager.getState().playerStats.unlockedAttacks[0] || 'bullet'

      // Filter upgrades: exclude incompatible, dependent, and mismatched attack types
      const validUpgrades = allUpgrades.filter((upgrade: any) => {
        // Check if already applied (non-stackable)
        if (!upgrade.stackable && currentUpgrades.includes(upgrade.id)) {
          return false
        }

        // Check attack type - if upgrade has attackType, must match current
        if (upgrade.attackType && upgrade.attackType !== currentAttackType) {
          return false
        }

        // Check dependencies - must have required upgrades
        if (upgrade.dependentOn && upgrade.dependentOn.length > 0) {
          const required = upgrade.dependencyCount || 1
          const hasDeps = upgrade.dependentOn.filter((id: string) => currentUpgrades.includes(id)).length
          if (hasDeps < required) {
            return false
          }
        }

        // Check replaces - can't offer if conflicting variant exists
        if (upgrade.replaces) {
          const replaces = Array.isArray(upgrade.replaces) ? upgrade.replaces : [upgrade.replaces]
          if (replaces.some((id: string) => currentUpgrades.includes(id))) {
            return false
          }
        }

        // Check incompatibilities
        if (upgrade.incompatibleWith && upgrade.incompatibleWith.length > 0) {
          if (upgrade.incompatibleWith.some((id: string) => currentUpgrades.includes(id))) {
            return false
          }
        }

        return true
      })

      // Pick 3 random valid upgrades using rarity weights
      const rarity_weights = { 'common': 0.50, 'uncommon': 0.30, 'rare': 0.15, 'epic': 0.04, 'legendary': 0.01 }
      const selected = []
      const attempts = 0
      const maxAttempts = 100

      let attemptCount = 0
      while (selected.length < 3 && validUpgrades.length > 0 && attemptCount < maxAttempts) {
        // Pick a rarity based on weights
        const rand = Math.random()
        let cumulative = 0
        let pickedRarity = 'common'
        for (const [rarity, weight] of Object.entries(rarity_weights)) {
          cumulative += weight
          if (rand < cumulative) {
            pickedRarity = rarity
            break
          }
        }

        // Find upgrades with this rarity
        const rarityUpgrades = validUpgrades.filter((u: any) => u.rarity === pickedRarity)

        if (rarityUpgrades.length > 0) {
          // Pick random upgrade from this rarity
          const randomIdx = Math.floor(Math.random() * rarityUpgrades.length)
          const upgrade = rarityUpgrades[randomIdx]

          // Avoid duplicates unless stackable
          const alreadySelected = selected.some((u: any) => u.id === upgrade.id)
          if (!alreadySelected || upgrade.stackable) {
            selected.push(upgrade)
            // Remove from valid pool to avoid duplicates in selection
            const poolIdx = validUpgrades.indexOf(upgrade)
            if (poolIdx > -1) {
              validUpgrades.splice(poolIdx, 1)
            }
          }
        }

        attemptCount++
      }

      this.offeredUpgrades = selected.map((u: any) => ({ id: u.id, purchased: false }))

      console.log('[WAVE VALIDATION] Local reroll - new upgrades:', this.offeredUpgrades)
      return { upgrades: this.offeredUpgrades, newPoints }
    }

    try {
      const token = localStorage.getItem('token')
      if (!token) {
        console.error('No auth token found')
        return null
      }

      const response = await axios.post('/api/waves/reroll', {
        wave: wave,
        reroll_cost: rerollCost
      }, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.data.success) {
        // Update the offered upgrades with the new ones
        this.offeredUpgrades = response.data.offered_upgrades
        console.log('Rerolled upgrades:', this.offeredUpgrades)
        console.log('New points after reroll:', response.data.current_points)

        // Return both upgrades and new points
        return {
          upgrades: this.offeredUpgrades,
          newPoints: response.data.current_points
        }
      }

      return null
    } catch (error: any) {
      console.error('Failed to reroll upgrades:', error)
      console.error('Error response:', error.response?.data)
      console.error('Error status:', error.response?.status)
      return null
    }
  }

  /**
   * Get current stats for debugging
   */
  getStats() {
    return {
      frameCount: this.frameCount,
      frameSamples: this.frameSamples.length,
      enemyDeaths: this.enemyDeaths.length,
      totalKills: this.totalKills,
      totalDamage: this.totalDamage,
      damageTaken: this.damageTaken,
      hasToken: !!this.waveToken
    }
  }
}

// Singleton instance
export const waveValidation = new WaveValidationService()
