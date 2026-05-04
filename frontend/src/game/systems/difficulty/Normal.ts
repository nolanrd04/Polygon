import type { Difficulty, EnemySpawnWeight, RarityWeights } from './Difficulty'

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
 * Per-wave rarity weights for upgrade rolls. Each entry must sum to 1.
 * Fallback applies for waves not listed (typically late-game).
 */
const RARITY_WEIGHTS_BY_WAVE: Record<number, RarityWeights> = {
  1:  { common: 0.50, uncommon: 0.35, rare: 0.15,  epic: 0.00,  legendary: 0.00 },
  2:  { common: 0.50, uncommon: 0.35, rare: 0.15,  epic: 0.00,  legendary: 0.00 },
  3:  { common: 0.48, uncommon: 0.36, rare: 0.16,  epic: 0.00,  legendary: 0.00 },
  4:  { common: 0.45, uncommon: 0.38, rare: 0.17,  epic: 0.00,  legendary: 0.00 },
  5:  { common: 0.44, uncommon: 0.36, rare: 0.16,  epic: 0.04,  legendary: 0.00 },
  6:  { common: 0.42, uncommon: 0.36, rare: 0.18,  epic: 0.04,  legendary: 0.00 },
  7:  { common: 0.41, uncommon: 0.37, rare: 0.18,  epic: 0.04,  legendary: 0.00 },
  8:  { common: 0.40, uncommon: 0.38, rare: 0.18,  epic: 0.04,  legendary: 0.00 },
  9:  { common: 0.38, uncommon: 0.38, rare: 0.19,  epic: 0.05,  legendary: 0.00 },
  10: { common: 0.37,uncommon: 0.38, rare: 0.19,  epic: 0.05, legendary: 0.01 },

  11: { common: 0.34, uncommon: 0.40, rare: 0.2,  epic: 0.05,  legendary: 0.01 },
  12: { common: 0.32, uncommon: 0.41, rare: 0.21,  epic: 0.05, legendary: 0.01 },
  13: { common: 0.31, uncommon: 0.42, rare: 0.21,  epic: 0.05,  legendary: 0.01 },
  14: { common: 0.29, uncommon: 0.42, rare: 0.22,  epic: 0.06, legendary: 0.01 },
  15: { common: 0.28, uncommon: 0.43, rare: 0.22,  epic: 0.06,  legendary: 0.01 },
  16: { common: 0.28, uncommon: 0.41, rare: 0.23,  epic: 0.06, legendary: 0.02 },
  17: { common: 0.28, uncommon: 0.40, rare: 0.23,  epic: 0.07,  legendary: 0.02 },
  18: { common: 0.26, uncommon: 0.41, rare: 0.24,  epic: 0.07,  legendary: 0.02 },
  19: { common: 0.25, uncommon: 0.41, rare: 0.25,  epic: 0.07,  legendary: 0.02 },
  20: { common: 0.24, uncommon: 0.40, rare: 0.25,  epic: 0.08,  legendary: 0.03 },

  21: { common: 0.24, uncommon: 0.39, rare: 0.26,  epic: 0.08,  legendary: 0.03 },  
  22: { common: 0.24, uncommon: 0.38, rare: 0.27,  epic: 0.08,  legendary: 0.03 },
  23: { common: 0.23, uncommon: 0.37, rare: 0.28,  epic: 0.09,  legendary: 0.03 },
  24: { common: 0.22, uncommon: 0.37, rare: 0.29,  epic: 0.09,  legendary: 0.03 },
  25: { common: 0.22, uncommon: 0.36, rare: 0.30,  epic: 0.09,  legendary: 0.03 },
  26: { common: 0.21, uncommon: 0.36, rare: 0.30,  epic: 0.09, legendary: 0.04 },
  27: { common: 0.20, uncommon: 0.35, rare: 0.31,  epic: 0.10, legendary: 0.04 },
  28: { common: 0.20, uncommon: 0.34, rare: 0.32,  epic: 0.10, legendary: 0.04 },
  29: { common: 0.20, uncommon: 0.33, rare: 0.32,  epic: 0.11, legendary: 0.04 },
  30: { common: 0.20, uncommon: 0.31, rare: 0.33,  epic: 0.11, legendary: 0.05 },



}

const FALLBACK_RARITY_WEIGHTS: RarityWeights = {
  common: 0.2, uncommon: 0.31, rare: 0.33, epic: 0.11, legendary: 0.05,
}

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

  getRarityWeights(wave: number): RarityWeights {
    return RARITY_WEIGHTS_BY_WAVE[wave] ?? FALLBACK_RARITY_WEIGHTS
  },
}