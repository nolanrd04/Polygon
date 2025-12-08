/**
 * Manages stat modifiers from upgrades.
 * Modifiers are additive or multiplicative changes to stats.
 */
class UpgradeModifierSystemClass {
  // target -> stat -> total modifier value
  private additiveModifiers: Map<string, Map<string, number>> = new Map()
  private multiplicativeModifiers: Map<string, Map<string, number>> = new Map()

  /**
   * Add a modifier to a target's stat.
   *
   * @param target - What entity to modify (e.g., 'bullet', 'player', 'triangle')
   * @param stat - What stat to modify (e.g., 'damage', 'speed', 'health')
   * @param value - The value to add or multiply
   * @param isMultiplier - If true, value is a multiplier (1.2 = +20%). If false, it's additive (+5)
   */
  addModifier(target: string, stat: string, value: number, isMultiplier: boolean = false): void {
    const modifiers = isMultiplier ? this.multiplicativeModifiers : this.additiveModifiers

    if (!modifiers.has(target)) {
      modifiers.set(target, new Map())
    }

    const targetModifiers = modifiers.get(target)!
    const current = targetModifiers.get(stat) || (isMultiplier ? 0 : 0)

    if (isMultiplier) {
      // Add to existing multiplier (so 5% + 5% = 10%, not 10.25%)
      targetModifiers.set(stat, current + value)
    } else {
      // Add to existing value
      targetModifiers.set(stat, current + value)
    }
  }

  /**
   * Remove a modifier (used when an upgrade is removed).
   * Note: This removes ALL modifiers for a stat, so it's best used with non-stackable upgrades.
   */
  removeModifier(target: string, stat: string): void {
    this.additiveModifiers.get(target)?.delete(stat)
    this.multiplicativeModifiers.get(target)?.delete(stat)
  }

  /**
   * Get the total additive modifier for a stat.
   *
   * @param target - The entity type (e.g., 'bullet')
   * @param stat - The stat name (e.g., 'damage')
   * @returns The total additive value (e.g., +15 damage from multiple upgrades)
   */
  getAdditiveModifier(target: string, stat: string): number {
    return this.additiveModifiers.get(target)?.get(stat) || 0
  }

  /**
   * Get the total multiplicative modifier for a stat.
   *
   * @param target - The entity type (e.g., 'bullet')
   * @param stat - The stat name (e.g., 'speed')
   * @returns The total multiplier (e.g., 1.5 = 150% = +50%)
   */
  getMultiplicativeModifier(target: string, stat: string): number {
    return this.multiplicativeModifiers.get(target)?.get(stat) || 0
  }

  /**
   * Apply all modifiers to a base value.
   * Formula: (base + additive) * (1 + multiplicative)
   *
   * Example:
   *   base = 10
   *   additive = +5 (from upgrades)
   *   multiplicative = 0.2 (20% boost)
   *   result = (10 + 5) * (1 + 0.2) = 15 * 1.2 = 18
   *
   * @param target - The entity type
   * @param stat - The stat name
   * @param baseValue - The original value before modifiers
   * @returns The modified value
   */
  applyModifiers(target: string, stat: string, baseValue: number): number {
    const additive = this.getAdditiveModifier(target, stat)
    const multiplicative = this.getMultiplicativeModifier(target, stat)

    return (baseValue + additive) * (1 + multiplicative)
  }

  /**
   * Get all modifiers for a target as a Map.
   * Useful for applying all modifiers at once to an entity.
   *
   * @param target - The entity type
   * @returns Map of stat -> final modifier value (additive only, for simplicity)
   */
  getModifiers(target: string): Map<string, number> {
    const result = new Map<string, number>()

    const additive = this.additiveModifiers.get(target)
    if (additive) {
      for (const [stat, value] of additive) {
        result.set(stat, value)
      }
    }

    // Note: Multiplicative modifiers need the base value to apply,
    // so they're not included here. Use applyModifiers() instead.

    return result
  }

  /**
   * Get all additive modifiers for a target.
   */
  getAllAdditiveModifiers(target: string): Map<string, number> {
    return this.additiveModifiers.get(target) || new Map()
  }

  /**
   * Get all multiplicative modifiers for a target.
   */
  getAllMultiplicativeModifiers(target: string): Map<string, number> {
    return this.multiplicativeModifiers.get(target) || new Map()
  }

  /**
   * Reset all modifiers (for new game).
   */
  reset(): void {
    this.additiveModifiers.clear()
    this.multiplicativeModifiers.clear()
  }

  /**
   * Debug: Print all active modifiers.
   */
  debug(): void {
    console.log('=== Additive Modifiers ===')
    for (const [target, stats] of this.additiveModifiers) {
      console.log(`${target}:`, Object.fromEntries(stats))
    }

    console.log('=== Multiplicative Modifiers ===')
    for (const [target, stats] of this.multiplicativeModifiers) {
      console.log(`${target}:`, Object.fromEntries(stats))
    }
  }
}

export const UpgradeModifierSystem = new UpgradeModifierSystemClass()
