import type { Difficulty, EnemySpawnWeight } from './Difficulty'

/**
 * Per-wave enemy counts. Fallback formula applies for waves not listed.
 */
const ENEMY_COUNTS: Record<number, number> = {
  1: 30, 2: 35, 3: 30, 4: 40, 5: 40,
  6: 60, 7: 45, 8: 50, 9: 60, 10: 60,
  11: 70, 12: 80, 13: 100, 14: 100, 15: 85,
  16: 90, 17: 80, 18: 100, 19: 100,
}

/**
 * Per-wave spawn weights. Fallback applies for waves not listed.
 * Higher weight = more likely to spawn.
 */
const SPAWN_WEIGHTS: Record<number, EnemySpawnWeight[]> = {
  1: [{ type: 'triangle', weight: 100 }],
  2: [{ type: 'triangle', weight: 100 }],
  3: [{ type: 'triangle', weight: 70 }, { type: 'square', weight: 30 }],
  4: [{ type: 'triangle', weight: 70 }, { type: 'square', weight: 30 }],
  5: [{ type: 'triangle', weight: 60 }, { type: 'square', weight: 30 }, { type: 'super_triangle', weight: 10 }],
  6: [{ type: 'triangle', weight: 60 }, { type: 'square', weight: 30 }, { type: 'super_triangle', weight: 10 }],
  7: [{ type: 'triangle', weight: 40 }, { type: 'square', weight: 25 }, { type: 'super_triangle', weight: 20 }, { type: 'pentagon', weight: 15 }],
  8: [{ type: 'triangle', weight: 30 }, { type: 'square', weight: 20 }, { type: 'super_triangle', weight: 20 }, { type: 'pentagon', weight: 15 }, { type: 'diamond', weight: 15 }],
  9: [{ type: 'triangle', weight: 30 }, { type: 'square', weight: 20 }, { type: 'super_triangle', weight: 20 }, { type: 'pentagon', weight: 15 }, { type: 'diamond', weight: 15 }],
  10: [{ type: 'triangle', weight: 30 }, { type: 'square', weight: 20 }, { type: 'super_triangle', weight: 20 }, { type: 'pentagon', weight: 15 }, { type: 'diamond', weight: 15 }],
  11: [{ type: 'triangle', weight: 25 }, { type: 'square', weight: 20 }, { type: 'super_triangle', weight: 20 }, { type: 'pentagon', weight: 15 }, { type: 'diamond', weight: 15 }, { type: 'hexagon', weight: 5 }],
  12: [{ type: 'triangle', weight: 20 }, { type: 'square', weight: 20 }, { type: 'super_triangle', weight: 20 }, { type: 'pentagon', weight: 15 }, { type: 'diamond', weight: 20 }, { type: 'hexagon', weight: 5 }],
  13: [{ type: 'triangle', weight: 10 }, { type: 'square', weight: 20 }, { type: 'super_triangle', weight: 45 }, { type: 'pentagon', weight: 15 }, { type: 'diamond', weight: 10 }],
  14: [{ type: 'triangle', weight: 10 }, { type: 'square', weight: 10 }, { type: 'super_triangle', weight: 20 }, { type: 'pentagon', weight: 15 }, { type: 'diamond', weight: 45 }],
  15: [{ type: 'square', weight: 30 }, { type: 'super_triangle', weight: 20 }, { type: 'pentagon', weight: 15 }, { type: 'diamond', weight: 20 }, { type: 'hexagon', weight: 5 }, { type: 'octogon', weight: 10 }],
  16: [{ type: 'square', weight: 25 }, { type: 'super_triangle', weight: 20 }, { type: 'pentagon', weight: 15 }, { type: 'diamond', weight: 15 }, { type: 'hexagon', weight: 10 }, { type: 'octogon', weight: 15 }],
  17: [{ type: 'triangle', weight: 20 }, { type: 'square', weight: 35 }, { type: 'super_triangle', weight: 15 }, { type: 'octogon', weight: 5 }, { type: 'super_square', weight: 25 }],
  18: [{ type: 'square', weight: 40 }, { type: 'super_triangle', weight: 15 }, { type: 'octogon', weight: 10 }, { type: 'super_square', weight: 35 }],
  19: [{ type: 'square', weight: 20 }, { type: 'super_triangle', weight: 10 }, { type: 'pentagon', weight: 5 }, { type: 'diamond', weight: 15 }, { type: 'hexagon', weight: 10 }, { type: 'octogon', weight: 15 }, { type: 'super_square', weight: 25 }],
}

const FALLBACK_WEIGHTS: EnemySpawnWeight[] = [
  { type: 'triangle', weight: 5 },
  { type: 'square', weight: 10 },
  { type: 'super_triangle', weight: 20 },
  { type: 'pentagon', weight: 10 },
  { type: 'hexagon', weight: 10 },
  { type: 'diamond', weight: 20 },
  { type: 'octogon', weight: 15 },
  { type: 'super_square', weight: 10 },
]

/**
 * Waves 10/20/30 schedule a boss spawn in addition to the normal spawn pool.
 * Each entry is the ordered list of enemy type IDs to drop when the boss
 * trigger fires.
 */
const SCHEDULED_BOSS_SPAWNS: Record<number, string[]> = {
  10: ['hexagon', 'hexagon', 'hexagon', 'dodecahedron'],
  20: ['hexagon', 'hexagon', 'hexagon', 'dodecahedron'],
  30: ['hexagon', 'hexagon', 'hexagon', 'dodecahedron'],
}

export const NormalDifficulty: Difficulty = {
  id: 'normal',
  label: 'Normal',

  getEnemyCount(wave: number): number {
    const explicit = ENEMY_COUNTS[wave]
    if (explicit !== undefined) return explicit
    return Math.floor(100 + wave * 2 + Math.pow(wave, 1.2))
  },

  getSpawnWeights(wave: number): EnemySpawnWeight[] {
    return SPAWN_WEIGHTS[wave] ?? FALLBACK_WEIGHTS
  },

  getSpawnDelay(wave: number): number {
    // Earlier waves use gentler scaling so the very first waves don't feel frantic.
    if (wave < 3) return Math.max(50, 1000 - wave * 25)
    if (wave < 5) return Math.max(50, 1000 - wave * 35)
    return Math.max(50, 1000 - wave * 50)
  },

  getScheduledBossSpawns(wave: number): string[] | null {
    return SCHEDULED_BOSS_SPAWNS[wave] ?? null
  },
}