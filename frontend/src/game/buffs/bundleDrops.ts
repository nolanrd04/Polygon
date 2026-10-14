/**
 * Bundle buff drops: the explicit whitelist of buffs an upgrade bundle can
 * roll. A buff that isn't listed here never drops, whatever its def says.
 * See BUFFS.md → Bundle drops.
 */

import { BuffID } from '../data/ID'
import type { BuffStatOverrides } from './Buff'

/**
 * What a `roll` may read. Only things the server also knows, since every
 * `roll` is hand-ported to backend/app/core/buff_rolls.py and the server
 * rolls online. No live game state (HP, enemies, position).
 */
export interface BundleBuffRollContext {
  wave: number
  difficultyId: string
  upgrades: string[]
}

/** One rolled grant, applied as `AddBuff(buff, duration, { stats })`. */
export interface BundleBuffRoll {
  buff: BuffID
  duration: number
  stats?: BuffStatOverrides
}

export interface BundleBuffDrop {
  buff: BuffID
  /** Rolled duration range in ms. Not the def's maxDuration (that's the stacking cap). */
  minDuration?: number
  maxDuration?: number
  /**
   * Custom roll, e.g. a duration or stats that scale with the wave. Must
   * have a matching port in buff_rolls.py, or sync-check fails.
   */
  roll?: (drop: BundleBuffDrop, ctx: BundleBuffRollContext) => BundleBuffRoll
}

export const DEFAULT_DROP_MIN_DURATION = 5000
export const DEFAULT_DROP_MAX_DURATION = 10000

export const BUNDLE_BUFF_DROPS: BundleBuffDrop[] = [
  // Positive
  { buff: BuffID.BurningBullets1 },
  { buff: BuffID.BurningBullets2 },
  { buff: BuffID.BurningBullets3 },
  { buff: BuffID.BurningBullets4 },
  { buff: BuffID.BurningBullets5 },
  { buff: BuffID.PoisonTippedRounds1 },
  { buff: BuffID.PoisonTippedRounds2 },
  { buff: BuffID.PoisonTippedRounds3 },
  { buff: BuffID.PoisonTippedRounds4 },
  { buff: BuffID.PoisonTippedRounds5 },
  { buff: BuffID.Haste1 },
  { buff: BuffID.Haste2 },
  { buff: BuffID.Haste3 },
  { buff: BuffID.Wrath1 },
  { buff: BuffID.Wrath2 },
  { buff: BuffID.Wrath3 },
  { buff: BuffID.Wrath4 },
  { buff: BuffID.Wrath5 },
  { buff: BuffID.Toughness1 },
  { buff: BuffID.Toughness2 },
  { buff: BuffID.Frenzy },
  { buff: BuffID.Mending },

  // Debuffs
  { buff: BuffID.Chilled1 },
  { buff: BuffID.Chilled2 },
  { buff: BuffID.Chilled3 },
  { buff: BuffID.Chilled4 },
  { buff: BuffID.Chilled5 },
  { buff: BuffID.OnFire1 },
  { buff: BuffID.OnFire2, minDuration: 6000, maxDuration: 12000 },
  { buff: BuffID.OnFire3, minDuration: 7000, maxDuration: 20000 },
  { buff: BuffID.OnFire4, minDuration: 9000, maxDuration: 30000 },
  { buff: BuffID.OnFire5, minDuration: 10000, maxDuration: 60000 },
  { buff: BuffID.Poison1 },
  { buff: BuffID.Poison2, minDuration: 6000, maxDuration: 12000 },
  { buff: BuffID.Poison3, minDuration: 7000, maxDuration: 20000 },
  { buff: BuffID.Poison4, minDuration: 8000, maxDuration: 25000 },
  { buff: BuffID.Poison5, minDuration: 10000, maxDuration: 60000 },
  { buff: BuffID.Slowness1 },
  { buff: BuffID.Slowness2 },
  { buff: BuffID.Slowness3 },
  { buff: BuffID.Slowness4 },
  { buff: BuffID.Slowness5 },
  { buff: BuffID.Vulnerable1 },
  { buff: BuffID.Vulnerable2 },
  { buff: BuffID.Vulnerable3 },
  { buff: BuffID.Weakness1 },
  { buff: BuffID.Weakness2 },
  { buff: BuffID.Weakness3 },
  { buff: BuffID.Weakness4 },
]

/** Uniform roll in [minDuration, maxDuration], whole ms. */
export function rollDropDuration(drop: BundleBuffDrop): number {
  const min = drop.minDuration ?? DEFAULT_DROP_MIN_DURATION
  const max = Math.max(min, drop.maxDuration ?? DEFAULT_DROP_MAX_DURATION)
  return Math.round(min + Math.random() * (max - min))
}

/** The entry's own `roll`, else the default duration roll with the def's stats. Offline only; online the server rolls. */
export function rollDrop(drop: BundleBuffDrop, ctx: BundleBuffRollContext): BundleBuffRoll {
  return drop.roll ? drop.roll(drop, ctx) : { buff: drop.buff, duration: rollDropDuration(drop) }
}
