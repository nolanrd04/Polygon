import type { UpgradeDef } from '../../upgrades/Upgrade'

/**
 * Stores upgrade-granted counters and flags that other systems poll:
 * - effect counters (shield charges, ricochet, multishot, ...)
 * - visual effect flags (currently inert — nothing renders them)
 *
 * Event-driven behavior (lifesteal, regen, protection, thorns, explode on
 * kill) no longer lives here — each upgrade class implements it as engine
 * hooks dispatched by UpgradeSystem in ledger order. Ability ownership isn't
 * mirrored here either: AbilitySystem reads the ledger, so there's one source
 * of truth for "does the player have dash".
 */
class UpgradeEffectSystemClass {
  private activeEffects: Map<string, number> = new Map() // effectId -> total value
  private visualEffects: Map<string, UpgradeDef> = new Map()

  /**
   * Add an effect with a value (can be called multiple times to stack).
   */
  addEffect(effectId: string, value: number): void {
    const current = this.activeEffects.get(effectId) || 0
    this.activeEffects.set(effectId, current + value)
  }

  /**
   * Remove an effect.
   */
  removeEffect(effectId: string): void {
    this.activeEffects.delete(effectId)
  }

  /**
   * Check if an effect is active.
   */
  hasEffect(effectId: string): boolean {
    return this.activeEffects.has(effectId) && (this.activeEffects.get(effectId) || 0) > 0
  }

  /**
   * Get the total value of an effect.
   */
  getEffectValue(effectId: string): number {
    return this.activeEffects.get(effectId) || 0
  }

  /**
   * Add a visual effect.
   */
  addVisualEffect(effectId: string, upgrade: UpgradeDef): void {
    this.visualEffects.set(effectId, upgrade)
  }

  /**
   * Remove a visual effect.
   */
  removeVisualEffect(effectId: string): void {
    this.visualEffects.delete(effectId)
  }

  /**
   * Check if a visual effect is active.
   */
  hasVisualEffect(effectId: string): boolean {
    return this.visualEffects.has(effectId)
  }

  /**
   * Get visual effect data.
   */
  getVisualEffect(effectId: string): UpgradeDef | undefined {
    return this.visualEffects.get(effectId)
  }

  /**
   * Reset all effects.
   */
  reset(): void {
    this.activeEffects.clear()
    this.visualEffects.clear()
  }
}

export const UpgradeEffectSystem = new UpgradeEffectSystemClass()
