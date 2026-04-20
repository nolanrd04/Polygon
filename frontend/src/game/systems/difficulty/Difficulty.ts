export type EnemySpawnWeight = {
  type: string
  weight: number
}

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
}