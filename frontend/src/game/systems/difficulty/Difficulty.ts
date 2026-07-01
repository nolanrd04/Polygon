export type EnemySpawnWeight = {
  type: string
  weight: number
}

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'

export type RarityWeights = Record<Rarity, number>

/**
 * A Difficulty owns all per-wave game-pacing data: how many enemies spawn,
 * which types, how fast, and what (if anything) is a scheduled boss spawn.
 *
 * Add a new difficulty by creating a new file in this folder that exports
 * a Difficulty object.
 */
export interface Difficulty {
  readonly id: string
  readonly label: string

  getEnemyCount(wave: number): number

  getSpawnWeights(wave: number): EnemySpawnWeight[]

  /** Milliseconds between enemy spawns for the given wave. */
  getSpawnDelay(wave: number): number

  /**
   * Returns the list of enemy type IDs to spawn when the boss trigger fires,
   * or null if this wave has no scheduled boss. The regular spawn pool still
   * runs in parallel; this is just the "scripted" boss spawn.
   */
  getScheduledBossSpawns(wave: number): string[] | null

  /**
   * Returns the rarity weights used when rolling offered upgrades for the
   * given wave. Weights should sum to 1. Earlier waves typically favor common;
   * later waves shift probability toward higher rarities.
   *
   * Mirrored on the backend in app/core/upgrade_data.py — keep them in sync.
   */
  getRarityWeights(wave: number): RarityWeights

  /**
   * Chance (0–1) that any enemy drops an upgrade bundle on death for the
   * given wave. Enemies may override this with their own bundleDropChance.
   */
  getBundleDropChance(wave: number): number

  /**
   * Rarity weights used when rolling the tier of a dropped upgrade bundle.
   * Separate from getRarityWeights so bundle drops can be tuned independently.
   */
  getBundleRarityWeights(wave: number): RarityWeights

  /**
   * Multiplier for enemy health scaling for the given wave.
   * Applied to each enemy's base health from SetDefaults().
   */
  getHealthMultiplier(wave: number): number

  /**
   * Multiplier for enemy damage scaling for the given wave.
   * Applied to each enemy's base damage from SetDefaults().
   */
  getDamageMultiplier(wave: number): number

  /**
   * Multiplier for enemy speed scaling for the given wave.
   * Capped by each enemy's individual speedCap property.
   */
  getSpeedMultiplier(wave: number, speedCap: number): number
}