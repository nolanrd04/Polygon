import { GameManager } from '../core/GameManager'
import { SaveManager } from './SaveManager'
import { FullGameSave } from './SaveTypes'
import { totalFragments } from '../systems/FragmentBudget'

/**
 * LocalSaveManager - Sandbox copy/paste save system
 *
 * Frontend-only save serialization for offline/sandbox runs.
 * Reuses the canonical FullGameSave shape (same as the backend save) so that
 * SaveManager.restoreGameState() can load the result without any special-casing.
 *
 * Upgrade order is preserved: UpgradeEntry[] is a JSON array, and
 * SaveManager.restoreGameState extracts ids in array order.
 */

function buildFullSaveFromCurrentState(): FullGameSave {
  const deathState = SaveManager.getDeathState()
  return {
    gameStats: SaveManager.getCurrentGameStats(),
    fragments: SaveManager.getCurrentFragments(),
    upgrades: SaveManager.getUpgradeHistory(),
    playerState: SaveManager.getCurrentPlayerState(),
    deathState,
    canContinue: deathState === null,
    lastSavedAt: Date.now()
  }
}

/**
 * Serialize the current game state to a JSON string.
 * The returned string is what the user copies out of the Save modal.
 */
export function exportLocalSave(): string {
  const fullSave = buildFullSaveFromCurrentState()
  return JSON.stringify(fullSave, null, 2)
}

/**
 * Parse a pasted JSON string into a FullGameSave.
 * Returns null if parsing fails or the shape is clearly wrong.
 */
export function importLocalSave(raw: string): FullGameSave | null {
  try {
    const parsed = JSON.parse(raw.trim())
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !parsed.gameStats ||
      !(parsed.fragments || parsed.points) || // old saves have points, converted on restore
      !parsed.upgrades ||
      !parsed.playerState ||
      !Array.isArray(parsed.upgrades.purchaseHistory)
    ) {
      console.warn('[LocalSaveManager] Import rejected: missing required fields')
      return null
    }
    return parsed as FullGameSave
  } catch (err) {
    console.warn('[LocalSaveManager] Import rejected: invalid JSON', err)
    return null
  }
}

/**
 * Apply a parsed save to the running game. Resets GameManager first so no
 * stale state from a previous run leaks through, then restores via the same
 * path the backend loader uses.
 */
export function applyLocalSave(save: FullGameSave): void {
  GameManager.reset()
  SaveManager.restoreGameState(save)
}

/**
 * Short human-readable summary for the Save modal header.
 */
export function summarizeLocalSave(): string {
  const stats = SaveManager.getCurrentGameStats()
  const fragments = totalFragments(SaveManager.getCurrentFragments())
  const upgradeCount = SaveManager.getUpgradeHistory().purchaseHistory.length
  return `Wave ${stats.currentWave} • ${upgradeCount} upgrade${upgradeCount === 1 ? '' : 's'} • ${fragments} fragments`
}