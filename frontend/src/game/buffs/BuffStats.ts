import type { BuffStatID } from '../data/ID'

/**
 * One host's buff stat layer — tModLoader's ResetEffects pattern, kept in its
 * own object instead of on the entity's fields. Enemy AI writes `this.speed`
 * as state and player stats belong to the upgrade replay, so buffs never
 * touch those; they write here, and each stat is read where it's consumed.
 *
 * Reset at the start of every tick, then rebuilt by the host's active buffs.
 * Same formula as UpgradeModifierSystem: (base + additive) × (1 + multiplicative).
 */
export class BuffStats {
  private additive = new Map<BuffStatID, number>()
  private multiplicative = new Map<BuffStatID, number>()

  add(stat: BuffStatID, value: number, isMultiplier: boolean): void {
    const map = isMultiplier ? this.multiplicative : this.additive
    map.set(stat, (map.get(stat) ?? 0) + value)
  }

  apply(stat: BuffStatID, base: number = 0): number {
    return (base + (this.additive.get(stat) ?? 0)) * (1 + (this.multiplicative.get(stat) ?? 0))
  }

  reset(): void {
    this.additive.clear()
    this.multiplicative.clear()
  }
}
