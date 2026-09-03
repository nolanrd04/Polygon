import type { Difficulty, EnemySpawnWeight, RarityWeights } from './Difficulty'
import { ARROW_HEAD_IDS } from '../../entities/enemies/ArrowHead/ArrowHeadConfig'

/**
 * Per-wave enemy counts. Fallback formula applies for waves not listed.
 */
const ENEMY_COUNTS: Record<number, number> = {
  1: 30, 2: 35, 3: 30, 4: 40, 5: 40,
  6: 60, 7: 45, 8: 50, 9: 60, 10: 40,
  11: 70, 12: 80, 13: 100, 14: 100, 15: 85,
  16: 90, 17: 80, 18: 100, 19: 100, 20: 80,
  21: 110, 22: 115, 23: 120, 24: 120, 25: 125, 
  26: 125, 27: 125
}

/**
 * Per-wave spawn weights. Fallback applies for waves not listed.
 * Higher weight = more likely to spawn.
 */
const SPAWN_WEIGHTS: Record<number, EnemySpawnWeight[]> = {
  1: [{ type: 'triangle', weight: 100 }],
  2: [{ type: 'triangle', weight: 100 }],
  3: [{ type: 'triangle', weight: 70 }, { type: 'square', weight: 30 }],
  4: [{ type: 'triangle', weight: 60 }, { type: 'square', weight: 40 }],
  5: [{ type: 'triangle', weight: 60 }, { type: 'square', weight: 30 }, { type: 'super_triangle', weight: 10 }],
  6: [{ type: 'triangle', weight: 60 }, { type: 'square', weight: 30 }, { type: 'super_triangle', weight: 10 }],
  7: [{ type: 'triangle', weight: 40 }, { type: 'square', weight: 25 }, { type: 'super_triangle', weight: 20 }, { type: 'pentagon', weight: 15 }],
  8: [{ type: 'triangle', weight: 40 }, { type: 'square', weight: 15 }, { type: 'super_triangle', weight: 20 }, { type: 'pentagon', weight: 10 }, { type: 'diamond', weight: 15 }],
  9: [{ type: 'triangle', weight: 30 }, { type: 'square', weight: 20 }, { type: 'super_triangle', weight: 20 }, { type: 'pentagon', weight: 15 }, { type: 'diamond', weight: 15 }],
  10: [{ type: 'triangle', weight: 30 }, { type: 'square', weight: 20 }, { type: 'super_triangle', weight: 20 }, { type: 'pentagon', weight: 15 }, { type: 'diamond', weight: 15 }],

  11: [{ type: 'triangle', weight: 15 }, { type: 'square', weight: 20 }, { type: 'super_triangle', weight: 20 }, { type: 'pentagon', weight: 15 }, { type: 'diamond', weight: 15 }, { type: 'hexagon', weight: 15 }],
  12: [{ type: 'triangle', weight: 10 }, { type: 'square', weight: 15 }, { type: 'super_triangle', weight: 20 }, { type: 'pentagon', weight: 20 }, { type: 'diamond', weight: 20 }, { type: 'hexagon', weight: 15 }],
  13: [{ type: 'square', weight: 10 }, { type: 'super_triangle', weight: 20 }, { type: 'pentagon', weight: 15 }, { type: 'diamond', weight: 45 }, { type: 'hexagon', weight: 10 }],
  14: [{ type: 'square', weight: 30 }, { type: 'super_triangle', weight: 20 }, { type: 'pentagon', weight: 15 }, { type: 'diamond', weight: 20 }, { type: 'hexagon', weight: 5 }, { type: 'octogon', weight: 10 }],
  15: [{ type: 'square', weight: 25 }, { type: 'super_triangle', weight: 20 }, { type: 'pentagon', weight: 15 }, { type: 'diamond', weight: 15 }, { type: 'hexagon', weight: 10 }, { type: 'octogon', weight: 15 }],
  16: [{ type: 'triangle', weight: 20 }, { type: 'square', weight: 35 }, { type: 'super_triangle', weight: 15 }, { type: 'octogon', weight: 5 }, { type: 'super_square', weight: 25 }],
  17: [{ type: 'square', weight: 40 }, { type: 'super_triangle', weight: 15 }, { type: 'octogon', weight: 10 }, { type: 'super_square', weight: 35 }],
  18: [{ type: 'square', weight: 20 }, { type: 'super_triangle', weight: 10 }, { type: 'pentagon', weight: 5 }, { type: 'diamond', weight: 15 }, { type: 'hexagon', weight: 10 }, { type: 'octogon', weight: 15 }, { type: 'super_square', weight: 25 }],
  19: [{ type: 'square', weight: 20 }, { type: 'super_triangle', weight: 10 }, { type: 'pentagon', weight: 5 }, { type: 'diamond', weight: 15 }, { type: 'hexagon', weight: 10 }, { type: 'octogon', weight: 15 }, { type: 'super_square', weight: 25 }],
  20: [{ type: 'square', weight: 20 }, { type: 'super_triangle', weight: 10 }, { type: 'pentagon', weight: 5 }, { type: 'diamond', weight: 15 }, { type: 'hexagon', weight: 10 }, { type: 'octogon', weight: 15 }, { type: 'super_square', weight: 25 }],

  21: [{ type: 'triangle', weight: 10 }, { type: 'pentagon', weight: 15 }, { type: 'super_triangle', weight: 10 }, { type: 'diamond', weight: 25 }, { type: 'hexagon', weight: 10 }, { type: 'octogon', weight: 10 }, { type: 'super_square', weight: 10 }, { type: 'super_pentagon', weight: 10 }],
  22: [{ type: 'pentagon', weight: 15 }, { type: 'super_triangle', weight: 15 }, { type: 'diamond', weight: 25 }, { type: 'hexagon', weight: 10 }, { type: 'octogon', weight: 10 }, { type: 'super_square', weight: 10 }, { type: 'super_pentagon', weight: 15 }],
  23: [{ type: 'pentagon', weight: 10 }, { type: 'super_triangle', weight: 10 }, { type: 'diamond', weight: 35 }, { type: 'octogon', weight: 10 }, { type: 'super_square', weight: 10 }, { type: 'super_pentagon', weight: 25 }],
  24: [{ type: 'pentagon', weight: 5 }, { type: 'super_triangle', weight: 10 }, { type: 'diamond', weight: 30 }, { type: 'octogon', weight: 10 }, { type: 'super_square', weight: 10 }, { type: 'super_pentagon', weight: 35 }],

  25: [{ type: 'super_triangle', weight: 15 }, { type: 'diamond', weight: 20 }, { type: 'octogon', weight: 10 }, { type: 'super_square', weight: 15 }, { type: 'super_pentagon', weight: 25 }, { type: 'super_hexagon', weight: 15 }],
  26: [{ type: 'super_triangle', weight: 10 }, { type: 'diamond', weight: 20 }, { type: 'octogon', weight: 15 }, { type: 'super_square', weight: 15 }, { type: 'super_pentagon', weight: 20 }, { type: 'super_hexagon', weight: 20 }],
  27: [{ type: 'diamond', weight: 20 }, { type: 'octogon', weight: 20 }, { type: 'super_square', weight: 20 }, { type: 'super_pentagon', weight: 20 }, { type: 'super_hexagon', weight: 20 }],
}

const FALLBACK_WEIGHTS: EnemySpawnWeight[] = [
  { type: 'super_triangle', weight: 10 },
  { type: 'pentagon', weight: 10 },
  { type: 'hexagon', weight: 10 },
  { type: 'diamond', weight: 20 },
  { type: 'octogon', weight: 15 },
  { type: 'super_square', weight: 15 },
  { type: 'super_pentagon', weight: 10 },
  { type: 'super_hexagon', weight: 10 }
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
 * Rarity weights for bundle drops. Slightly more common-heavy than the
 * post-wave modal weights since bundles are bonus mid-combat loot.
 */
const BUNDLE_RARITY_WEIGHTS_BY_WAVE: Record<number, RarityWeights> = {
  1:  { common: 0.65, uncommon: 0.25, rare: 0.09, epic: 0.01, legendary: 0.0 },
  2:  { common: 0.64, uncommon: 0.26, rare: 0.09, epic: 0.01, legendary: 0.0 },
  3:  { common: 0.62, uncommon: 0.27, rare: 0.09, epic: 0.01, legendary: 0.0 },
  4:  { common: 0.60, uncommon: 0.28, rare: 0.10, epic: 0.02, legendary: 0.0 },
  5:  { common: 0.58, uncommon: 0.30, rare: 0.10, epic: 0.02, legendary: 0.00 },
  6:  { common: 0.55, uncommon: 0.32, rare: 0.11, epic: 0.02, legendary: 0.00 },
  7:  { common: 0.53, uncommon: 0.32, rare: 0.12, epic: 0.03, legendary: 0.00 },
  8:  { common: 0.52, uncommon: 0.33, rare: 0.12, epic: 0.03, legendary: 0.00 },
  9:  { common: 0.50, uncommon: 0.33, rare: 0.13, epic: 0.04, legendary: 0.00 },
  10: { common: 0.48, uncommon: 0.34, rare: 0.14, epic: 0.04, legendary: 0.00 },

  11: { common: 0.46, uncommon: 0.35, rare: 0.14, epic: 0.04, legendary: 0.01 },
  12: { common: 0.44, uncommon: 0.35, rare: 0.16, epic: 0.04, legendary: 0.01 },
  13: { common: 0.43, uncommon: 0.35, rare: 0.16, epic: 0.05, legendary: 0.01 },
  14: { common: 0.42, uncommon: 0.35, rare: 0.17, epic: 0.05, legendary: 0.01 },
  15: { common: 0.40, uncommon: 0.36, rare: 0.17, epic: 0.05, legendary: 0.02 },
  16: { common: 0.39, uncommon: 0.36, rare: 0.18, epic: 0.05, legendary: 0.02 },
  17: { common: 0.38, uncommon: 0.36, rare: 0.18, epic: 0.06, legendary: 0.02 },
  18: { common: 0.37, uncommon: 0.36, rare: 0.19, epic: 0.06, legendary: 0.02 },
  19: { common: 0.36, uncommon: 0.36, rare: 0.19, epic: 0.07, legendary: 0.02 },
  20: { common: 0.35, uncommon: 0.36, rare: 0.20, epic: 0.07, legendary: 0.02 },
  21: { common: 0.34, uncommon: 0.37, rare: 0.20, epic: 0.07, legendary: 0.02 },
  22: { common: 0.33, uncommon: 0.37, rare: 0.21, epic: 0.07, legendary: 0.02 },
  23: { common: 0.32, uncommon: 0.37, rare: 0.21, epic: 0.08, legendary: 0.02 },
  24: { common: 0.31, uncommon: 0.37, rare: 0.22, epic: 0.08, legendary: 0.02 },
  25: { common: 0.30, uncommon: 0.37, rare: 0.22, epic: 0.09, legendary: 0.02 },
  26: { common: 0.29, uncommon: 0.37, rare: 0.22, epic: 0.09, legendary: 0.03 },
  27: { common: 0.28, uncommon: 0.37, rare: 0.23, epic: 0.09, legendary: 0.03 },
  28: { common: 0.27, uncommon: 0.37, rare: 0.23, epic: 0.10, legendary: 0.03 },
  29: { common: 0.26, uncommon: 0.37, rare: 0.24, epic: 0.10, legendary: 0.03 },
  30: { common: 0.25, uncommon: 0.37, rare: 0.24, epic: 0.11, legendary: 0.03 },
}

const FALLBACK_BUNDLE_RARITY_WEIGHTS: RarityWeights = {
  common: 0.25, uncommon: 0.37, rare: 0.24, epic: 0.11, legendary: 0.03,
}

/**
 * Waves 10/20/30 schedule a boss spawn in addition to the normal spawn pool.
 * Each entry is the ordered list of enemy type IDs to drop when the boss
 * trigger fires.
 */
const SCHEDULED_BOSS_SPAWNS: Record<number, string[]> = {
  10: ['hexagon', 'hexagon', 'hexagon', 'dodecahedron'],
  20: ['hexagon', 'hexagon', 'hexagon', ARROW_HEAD_IDS.head],
  30: ['hexagon', 'hexagon', 'hexagon', 'dodecahedron', ARROW_HEAD_IDS.head],
}

export const NormalDifficulty: Difficulty = {
  id: 'normal',
  label: 'Normal',

  getEnemyCount(wave: number): number {
    const explicit = ENEMY_COUNTS[wave]
    if (explicit !== undefined) return explicit
    // NOT auto-synced - fallback formula is hand-ported as code, not table
    // data. If you change this, manually update the matching fallback in
    // backend/app/core/difficulty/normal.py get_enemy_count().
    return Math.floor(100 + wave * 2 + Math.pow(wave, 1.2))
  },

  getSpawnWeights(wave: number): EnemySpawnWeight[] {
    return SPAWN_WEIGHTS[wave] ?? FALLBACK_WEIGHTS
  },

  getSpawnDelay(wave: number): number {
    // No backend copy - Difficulty.get_spawn_delay() has no caller in
    // wave_service.py, so there's nothing server-side to keep this in sync
    // with. Frontend-only, safe to change without touching the backend.
    // Earlier waves use gentler scaling so the very first waves don't feel frantic.
    if (wave < 6) 
    {
      return 1000 - wave * 25  // 975, 950, 925, 900, 875
    }
    if (wave < 10)
    {
      return 1000 - wave * 20  // 880, 860, 840, 820
    } 
    if (wave == 10)
    {
      return 925
    }
    else if (wave <= 15)
    {
      return 1085 - wave * 35  // 700, 665, 630, 595, 560
    }
    else if (wave < 20)
    {
      return 870 - wave * 20  // 550, 530, 510, 490
    }
    else if (wave == 20)
    {
      return 700
    }
    else if (wave < 30)
    {
      return 765 - wave * 15  // 450 to 300
    }
    if (wave == 30)
    {
      return 550
    }
    else if (wave < 40)
    {
      return 765 - wave * 15  // 300 to 150
    }
    if (wave == 40)
    {
      return 400
    }
    return Math.max(50, 560 - wave * 10)  // 150 to 50
  },

  getScheduledBossSpawns(wave: number): string[] | null {
    return SCHEDULED_BOSS_SPAWNS[wave] ?? null
  },

  // NOT auto-synced - RARITY_WEIGHTS_BY_WAVE/FALLBACK_RARITY_WEIGHTS above are
  // a manually-mirrored table, not covered by scripts/difficulty_defs_sync.py.
  // If you change a wave's weights (or the fallback), manually update
  // backend/app/core/data/rarity_weights.json to match.
  getRarityWeights(wave: number): RarityWeights {
    return RARITY_WEIGHTS_BY_WAVE[wave] ?? FALLBACK_RARITY_WEIGHTS
  },

  // NOT auto-synced - closed-form formula, hand-ported as code. If you change
  // any threshold/value here, manually update
  // backend/app/core/difficulty/normal.py get_bundle_drop_chance().
  getBundleDropChance(wave: number): number {
    if (wave <= 4)  return 0.13
    if (wave <= 9)  return 0.10
    if (wave <= 14) return 0.09
    if (wave <= 19) return 0.08
    if (wave <= 24) return 0.07
    if (wave <= 29) return 0.06
    return 0.05
  },

  getBundleRarityWeights(wave: number): RarityWeights {
    return BUNDLE_RARITY_WEIGHTS_BY_WAVE[wave] ?? FALLBACK_BUNDLE_RARITY_WEIGHTS
  },

  // NOT auto-synced - closed-form formula, hand-ported as code. If you change
  // the divisor (or the formula shape), manually update
  // backend/app/core/difficulty/normal.py get_health_multiplier().
  getHealthMultiplier(wave: number): number {
    return Math.exp(wave / 8)
  },

  // NOT auto-synced - closed-form formula, hand-ported as code. If you change
  // the divisor (or the formula shape), manually update
  // backend/app/core/difficulty/normal.py get_damage_multiplier().
  getDamageMultiplier(wave: number): number {
    return Math.exp(wave / 8)
  },

  // NOT auto-synced - closed-form formula, hand-ported as code. If you change
  // the coefficient (or the formula shape), manually update
  // backend/app/core/difficulty/normal.py get_speed_multiplier().
  getSpeedMultiplier(wave: number, speedCap: number): number {
    const speedMult = 1 + (wave * 0.05)
    return Math.min(speedCap, speedMult)
  },
}