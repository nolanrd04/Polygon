import { RarityID } from '../data/ID'
import type { Difficulty } from './difficulty/Difficulty'

/**
 * Fragment economy: per-tier counts, prices and the top-down wave budget.
 * The reasoning behind the numbers lives in frontend/documentation/DIFFICULTY.md.
 */

export type FragmentCounts = Record<RarityID, number>

export interface FragmentPrice {
  tier: RarityID
  amount: number
}

/** One conversion into a price's tier: spend `cost` of `from` to make `amount`. */
export interface ConversionStep {
  from: RarityID
  amount: number
  cost: number
}

export interface WaveFragmentBudget {
  enemies: FragmentCounts
  bonus: FragmentCounts
}

export const FRAGMENT_TIERS: readonly RarityID[] = [
  RarityID.Common,
  RarityID.Uncommon,
  RarityID.Rare,
  RarityID.Epic,
  RarityID.Legendary,
]

/** Worth of one fragment, in commons. */
export const FRAGMENT_WORTH: FragmentCounts = { common: 1, uncommon: 5, rare: 25, epic: 100, legendary: 400 }

/** Sides of each tier's polygon icon. */
export const FRAGMENT_SIDES: FragmentCounts = { common: 3, uncommon: 4, rare: 5, epic: 6, legendary: 7 }

export const FRAGMENT_COLORS: Record<RarityID, string> = {
  common: '#9ca3af',
  uncommon: '#4ade80',
  rare: '#60a5fa',
  epic: '#c084fc',
  legendary: '#facc15',
}

export const REROLL_PRICE: FragmentPrice = { tier: RarityID.Common, amount: 50 }

// Converting up costs 6/5 of a fragment's worth (a flat 20% penalty).
const UP_PENALTY_NUMERATOR = 6
const UP_PENALTY_DENOMINATOR = 5

const BONUS_SHARE = 0.1
const STARTING_FRAGMENT_VALUE = 3500
const STARTING_TIERS: readonly RarityID[] = [RarityID.Common, RarityID.Uncommon, RarityID.Rare]
const ENEMY_WEIGHT_JITTER_MIN = 0.8
const ENEMY_WEIGHT_JITTER_MAX = 1.2
const COMMONS_PER_OLD_POINT = 50

export function emptyFragments(): FragmentCounts {
  return { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0 }
}

export function addFragmentCounts(a: FragmentCounts, b: FragmentCounts): FragmentCounts {
  const out = emptyFragments()
  for (const tier of FRAGMENT_TIERS) out[tier] = a[tier] + b[tier]
  return out
}

export function totalFragments(counts: FragmentCounts): number {
  return FRAGMENT_TIERS.reduce((sum, tier) => sum + counts[tier], 0)
}

/** Old saves stored one currency: points. */
export function pointsToFragments(points: number): FragmentCounts {
  return { ...emptyFragments(), common: points * COMMONS_PER_OLD_POINT }
}

/** Corners of a tier's polygon, point up. */
export function fragmentPolygon(tier: RarityID, radius: number, cx: number = 0, cy: number = 0): { x: number; y: number }[] {
  const sides = FRAGMENT_SIDES[tier]
  return Array.from({ length: sides }, (_, i) => {
    const angle = -Math.PI / 2 + (i * Math.PI * 2) / sides
    return { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius }
  })
}

/** An upgrade's `cost` is counted in fragments of its own rarity. */
export function getUpgradePrice(upgrade: { rarity: RarityID; cost: number }): FragmentPrice {
  return { tier: upgrade.rarity, amount: upgrade.cost }
}

/** Price from the roll tab: the discount is the reason to roll instead of buying outright. */
export function getRollPrice(upgrade: { rarity: RarityID; cost: number }, discounted: boolean, difficulty: Difficulty): FragmentPrice {
  const price = getUpgradePrice(upgrade)
  if (!discounted) return price
  return { ...price, amount: Math.ceil((price.amount * (100 - difficulty.rollDiscountPercent)) / 100) }
}

/**
 * Rolls each offered upgrade's discount. One roll per id: a stackable can be
 * offered twice and buying matches by id, so its cards must share a price.
 * Mirrors roll_offer_discounts in backend/app/core/upgrade_data.py.
 */
export function rollOfferDiscounts<T extends { id: string }>(offers: T[], difficulty: Difficulty): (T & { discounted: boolean })[] {
  const rolls = new Map<string, boolean>()
  return offers.map(offer => {
    if (!rolls.has(offer.id)) rolls.set(offer.id, Math.random() < difficulty.rollDiscountChance)
    return { ...offer, discounted: rolls.get(offer.id)! }
  })
}

export function canAffordFragments(wallet: FragmentCounts, price: FragmentPrice): boolean {
  return wallet[price.tier] >= price.amount
}

export function spendFragments(wallet: FragmentCounts, price: FragmentPrice): FragmentCounts {
  return { ...wallet, [price.tier]: wallet[price.tier] - price.amount }
}

/**
 * What making `amount` of `to` costs in `from`. Converting down is free of
 * penalty; converting up costs 20% more. Rounded up once on the total, not per
 * fragment. Whole-number maths, so float error can't tip an exact total up by one.
 */
export function getConversionCost(from: RarityID, to: RarityID, amount: number): number {
  const isUp = FRAGMENT_WORTH[to] > FRAGMENT_WORTH[from]
  const numerator = amount * FRAGMENT_WORTH[to] * (isUp ? UP_PENALTY_NUMERATOR : UP_PENALTY_DENOMINATOR)
  return Math.ceil(numerator / (FRAGMENT_WORTH[from] * UP_PENALTY_DENOMINATOR))
}

/** Smallest amount of `to` that one conversion can make: down yields whole batches (1 rare = 5 uncommons). */
export function getConversionStep(from: RarityID, to: RarityID): number {
  return FRAGMENT_WORTH[to] > FRAGMENT_WORTH[from] ? 1 : FRAGMENT_WORTH[from] / FRAGMENT_WORTH[to]
}

/** The most of `to` this wallet can make from `from`. */
export function getMaxConversion(wallet: FragmentCounts, from: RarityID, to: RarityID): number {
  if (FRAGMENT_WORTH[to] > FRAGMENT_WORTH[from]) {
    const numerator = wallet[from] * FRAGMENT_WORTH[from] * UP_PENALTY_DENOMINATOR
    return Math.floor(numerator / (FRAGMENT_WORTH[to] * UP_PENALTY_NUMERATOR))
  }
  return wallet[from] * getConversionStep(from, to)
}

/** The wallet after converting, or null if the conversion isn't valid or affordable. */
export function convertFragments(wallet: FragmentCounts, from: RarityID, to: RarityID, amount: number): FragmentCounts | null {
  if (from === to || !Number.isInteger(amount) || amount <= 0) return null
  if (amount % getConversionStep(from, to) !== 0) return null
  const cost = getConversionCost(from, to, amount)
  if (cost > wallet[from]) return null
  return { ...wallet, [from]: wallet[from] - cost, [to]: wallet[to] + amount }
}

/**
 * Order auto-convert draws from: higher tiers first (no up penalty), closest
 * above the price first so a legendary isn't broken for one common; then lower
 * tiers, rarest first.
 */
function autoConversionSources(tier: RarityID): RarityID[] {
  const index = FRAGMENT_TIERS.indexOf(tier)
  const above = FRAGMENT_TIERS.slice(index + 1)
  const below = FRAGMENT_TIERS.slice(0, index).reverse()
  return [...above, ...below]
}

/**
 * Conversions that would cover this price, in autoConversionSources order.
 * Empty when the wallet already covers it, null when nothing can.
 */
export function planAutoConversion(wallet: FragmentCounts, price: FragmentPrice): ConversionStep[] | null {
  let missing = price.amount - wallet[price.tier]
  if (missing <= 0) return []

  const steps: ConversionStep[] = []
  for (const from of autoConversionSources(price.tier)) {
    if (missing <= 0) break
    const step = getConversionStep(from, price.tier)
    const amount = Math.min(getMaxConversion(wallet, from, price.tier), Math.ceil(missing / step) * step)
    if (amount === 0) continue
    steps.push({ from, amount, cost: getConversionCost(from, price.tier, amount) })
    missing -= amount
  }
  return missing > 0 ? null : steps
}

/** The wallet after auto-converting and paying, or null if it can't cover the price. */
export function payWithAutoConversion(wallet: FragmentCounts, price: FragmentPrice): FragmentCounts | null {
  const steps = planAutoConversion(wallet, price)
  if (!steps) return null
  const converted = steps.reduce(
    (current, { from, amount }) => convertFragments(current, from, price.tier, amount) ?? current,
    wallet
  )
  return spendFragments(converted, price)
}

/** The shop's payment plan: auto-convert when the player has it on, else the price's own tier only. */
export function planPayment(wallet: FragmentCounts, price: FragmentPrice, autoConvert: boolean): ConversionStep[] | null {
  if (autoConvert) return planAutoConversion(wallet, price)
  return canAffordFragments(wallet, price) ? [] : null
}

export function payFragments(wallet: FragmentCounts, price: FragmentPrice, autoConvert: boolean): FragmentCounts | null {
  if (autoConvert) return payWithAutoConversion(wallet, price)
  return canAffordFragments(wallet, price) ? spendFragments(wallet, price) : null
}

/** 2.04 becomes 2, or 3 on a 4% roll. Plain rounding would mean rare tiers never appear. */
function roundByChance(value: number): number {
  const whole = Math.floor(value)
  return whole + (Math.random() < value - whole ? 1 : 0)
}

export function rollWaveBudget(difficulty: Difficulty, wave: number): WaveFragmentBudget {
  const value = difficulty.getFragmentValue(wave)
  const split = difficulty.getFragmentValueSplit(wave)
  const budget: WaveFragmentBudget = { enemies: emptyFragments(), bonus: emptyFragments() }

  for (const tier of FRAGMENT_TIERS) {
    const total = roundByChance((value * split[tier]) / FRAGMENT_WORTH[tier])
    const bonus = roundByChance(total * BONUS_SHARE)
    budget.bonus[tier] = bonus
    budget.enemies[tier] = total - bonus
  }
  return budget
}

/**
 * Hands every fragment to one planned enemy, chosen by class weight x a
 * per-enemy random multiplier. Returns one count per entry of `typeIds`.
 */
export function distributeFragments(
  counts: FragmentCounts,
  typeIds: string[],
  weightOf: (typeId: string) => number
): FragmentCounts[] {
  const drops = typeIds.map(() => emptyFragments())
  if (typeIds.length === 0) return drops

  const jitterRange = ENEMY_WEIGHT_JITTER_MAX - ENEMY_WEIGHT_JITTER_MIN
  const weights = typeIds.map(id => weightOf(id) * (ENEMY_WEIGHT_JITTER_MIN + Math.random() * jitterRange))
  const totalWeight = weights.reduce((sum, w) => sum + w, 0)

  for (const tier of FRAGMENT_TIERS) {
    for (let n = 0; n < counts[tier]; n++) {
      let roll = Math.random() * totalWeight
      let index = 0
      while (index < weights.length - 1 && roll >= weights[index]) {
        roll -= weights[index]
        index++
      }
      drops[index][tier]++
    }
  }
  return drops
}

/** Rolls commons/uncommons/rares using wave 1's mix until exactly STARTING_FRAGMENT_VALUE. */
export function rollStartingFragments(difficulty: Difficulty): FragmentCounts {
  const split = difficulty.getFragmentValueSplit(1)
  const wallet = emptyFragments()
  let remaining = STARTING_FRAGMENT_VALUE

  while (remaining > 0) {
    // Tiers that would overshoot drop out, so the roll falls to a cheaper one.
    const tiers = STARTING_TIERS.filter(tier => FRAGMENT_WORTH[tier] <= remaining)
    const chances = tiers.map(tier => split[tier] / FRAGMENT_WORTH[tier])
    let roll = Math.random() * chances.reduce((sum, c) => sum + c, 0)
    let index = 0
    while (index < tiers.length - 1 && roll >= chances[index]) {
      roll -= chances[index]
      index++
    }
    wallet[tiers[index]]++
    remaining -= FRAGMENT_WORTH[tiers[index]]
  }
  return wallet
}