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
// - Written server-side by wave_service.complete_wave() on validated wave
//   completion or death (see backend/app/services/wave_service.py)
// - Updated after death: NO (frozen at death moment)
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
// - Credited server-side: wave-completion bonus + clamped per-kill score, via
//   wave_service.complete_wave() (normal completion and death)
// - Debited server-side: /api/waves/select-upgrade, /api/waves/reroll
// - Updated after death: YES (that final wave's score is still credited)
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
// - Server-appended on every validated purchase, by
//   /api/waves/select-upgrade (see backend/app/api/waves.py)
// - Updated after death: YES (can buy upgrades after death)
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
// - Set once server-side, from wave_service.complete_wave(is_death=True)'s
//   own computed totals (not trusted from the client)
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
// - speed/maxHealth/polygonSides/unlockedAttacks are derived server-side from
//   current_upgrades (wave_service._calculate_player_stats_from_upgrades),
//   never trusted from the client. health is the one dynamic field, reported
//   by the client and saved as-is by wave_service.
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
