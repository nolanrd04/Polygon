/**
 * MODULAR SAVE ARCHITECTURE
 *
 * Five separate save categories with different lifecycle rules:
 *
 * 1. GameStats - Current run stats (waves, kills) - frozen on death
 * 2. Points - Currency for upgrades - persists after death
 * 3. Upgrades - Ordered purchase history - persists after death
 * 4. DeathState - Frozen state at death - immutable once set
 * 5. PlayerState - Computed player stats (health, speed) - derived from upgrades
 */

// ============================================================================
// CATEGORY 1: GAME STATISTICS (Current Run)
// ============================================================================
// - Saved: On wave completion (NOT mid-wave)
// - Updated after death: NO (frozen at death moment)
// - Backend endpoint: POST /api/saves/game-stats
// ============================================================================

export interface GameStatsData {
  currentWave: number
  currentKills: number
  seed: number
  timeSurvived: number  // Seconds since game start
}

export interface GameStatsDataBackend {
  current_wave: number
  current_kills: number
  seed: number
  time_survived: number
}

// ============================================================================
// CATEGORY 2: POINTS (Persistent Currency)
// ============================================================================
// - Saved: On wave completion, upgrade purchase, death
// - Updated after death: YES (can still earn/spend after death)
// - Backend endpoint: POST /api/saves/points
// ============================================================================

export interface PointsData {
  currentPoints: number
}

export interface PointsDataBackend {
  current_points: number
}

// ============================================================================
// CATEGORY 3: UPGRADES (Ordered Purchase History)
// ============================================================================
// - Saved: On upgrade purchase
// - Updated after death: YES (can buy upgrades after death)
// - Backend endpoint: POST /api/saves/upgrades
// - CRITICAL: Order must be preserved for correct stat reconstruction
// ============================================================================

export interface UpgradeEntry {
  upgradeId: string
  purchasedAt: number  // Timestamp for ordering
  waveNumber: number   // Wave when purchased
}

export interface UpgradesSaveData {
  purchaseHistory: UpgradeEntry[]  // Ordered by purchasedAt
}

export interface UpgradeEntryBackend {
  upgrade_id: string
  purchased_at: number
  wave_number: number
}

export interface UpgradesSaveDataBackend {
  purchase_history: UpgradeEntryBackend[]
}

// ============================================================================
// CATEGORY 4: DEATH FROZEN STATE (Immutable on Death)
// ============================================================================
// - Saved: Once on player death (never updated after)
// - Backend endpoint: POST /api/saves/death-state
// - Purpose: Prevent exploit of quitting after death to preserve progress
// ============================================================================

export interface DeathFrozenState {
  frozenAt: number          // Timestamp of death
  wavesCompleted: number    // Wave number at death (completed, not reached)
  enemiesKilled: number     // Total kills at death
  timeSurvived: number      // Seconds played before death
  pointsAtDeath: number     // Points at moment of death
}

export interface DeathFrozenStateBackend {
  frozen_at: number
  waves_completed: number
  enemies_killed: number
  time_survived: number
  points_at_death: number
}

// ============================================================================
// CATEGORY 5: PLAYER STATE (Computed Stats)
// ============================================================================
// - Derived from base stats + applied upgrades
// - Saved: On wave completion (for quick restore)
// - Not a separate endpoint - bundled with game-stats
// ============================================================================

export interface PlayerStateData {
  currentHealth: number
  currentMaxHealth: number
  currentSpeed: number
  currentPolygonSides: number
  unlockedAttacks: string[]
}

export interface PlayerStateDataBackend {
  current_health: number
  current_max_health: number
  current_speed: number
  current_polygon_sides: number
  unlocked_attacks: string[]
}

// ============================================================================
// COMPOSITE: FULL GAME SAVE (For Loading)
// ============================================================================
// - Used when loading a saved game
// - Combines all categories into one response
// - Backend endpoint: GET /api/saves/full
// ============================================================================

export interface FullGameSave {
  // Game statistics (frozen on death if deathState exists)
  gameStats: GameStatsData

  // Points (always current)
  points: PointsData

  // Ordered upgrade history
  upgrades: UpgradesSaveData

  // Player computed state
  playerState: PlayerStateData

  // Death state (null if player is alive)
  deathState: DeathFrozenState | null

  // Meta
  canContinue: boolean  // false if deathState exists
  lastSavedAt: number
}

export interface FullGameSaveBackend {
  game_stats: GameStatsDataBackend
  points: PointsDataBackend
  upgrades: UpgradesSaveDataBackend
  player_state: PlayerStateDataBackend
  death_state: DeathFrozenStateBackend | null
  can_continue: boolean
  last_saved_at: number
}

// ============================================================================
// SAVE OPERATION TYPES
// ============================================================================

export enum SaveCategory {
  GAME_STATS = 'game-stats',
  POINTS = 'points',
  UPGRADES = 'upgrades',
  DEATH_STATE = 'death-state',
  PLAYER_STATE = 'player-state'
}

export interface SaveResult {
  success: boolean
  category: SaveCategory
  timestamp: number
  error?: string
}

// ============================================================================
// SAVE VALIDATION ERRORS
// ============================================================================

export enum SaveValidationError {
  PLAYER_DEAD = 'Cannot update game stats after death',
  WAVE_ACTIVE = 'Cannot save mid-wave',
  DEATH_STATE_EXISTS = 'Death state already frozen',
  NO_AUTH = 'No authentication token',
  BACKEND_ERROR = 'Backend validation failed'
}

// ============================================================================
// WAVE SNAPSHOT (For Anti-Cheat Validation)
// ============================================================================
// - Saved: When wave starts (locked until wave ends)
// - Purpose: Validate wave completion, prevent mid-wave exploits
// ============================================================================

export interface WaveSnapshot {
  waveNumber: number
  waveToken: string  // Backend-generated token for validation

  // Pre-wave state (locked)
  startingPoints: number
  startingHealth: number
  startingUpgrades: string[]

  // Timestamps
  waveStartTime: number
  waveEndTime?: number

  // Validation
  isLocked: boolean
  isCompleted: boolean
}

export interface WaveSnapshotBackend {
  wave_number: number
  wave_token: string
  starting_points: number
  starting_health: number
  starting_upgrades: string[]
  wave_start_time: number
  wave_end_time?: number
  is_locked: boolean
  is_completed: boolean
}
