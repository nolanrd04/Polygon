import { EventBus } from '../../core/EventBus'
import { UpgradeEffectSystem } from './UpgradeEffectSystem'
import { UpgradeModifierSystem } from './UpgradeModifierSystem'

/**
 * Upgrade definition structure from JSON
 */
export interface UpgradeDefinition {
  id: string
  name: string
  description: string
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'
  type: 'stat_modifier' | 'variant' | 'effect' | 'visual_effect' | 'ability'

  // For stat_modifier type
  target?: string
  stat?: string
  value?: number
  isMultiplier?: boolean // If true, value is a multiplier (e.g., 1.2 = +20%)

  // For variant type
  variantClass?: string
  replaces?: string[] // Other variants this replaces

  // For effect type
  effect?: string
  effectValue?: number

  // Stacking
  stackable: boolean
  maxStacks?: number

  // Upgrade tiers
  tier?: number
  upgradesTo?: string // ID of next tier upgrade

  // Dependencies
  dependentOn?: string[] // IDs of upgrades that must be owned
  dependencyCount?: number // How many of the dependent upgrades must be owned (default: 1)
  incompatibleWith?: string[] // IDs of upgrades that cannot be owned if this upgrade is active

  // Cost
  cost?: number
}

/**
 * Central upgrade management system.
 * Handles applying, tracking, and querying all upgrades.
 */
class UpgradeSystemClass {
  private appliedUpgrades: Map<string, UpgradeDefinition> = new Map()
  private stackCounts: Map<string, number> = new Map()
  private activeVariants: Map<string, string> = new Map() // target -> variantClass

  /**
   * Apply an upgrade to the player.
   * Returns false if the upgrade cannot be applied (stack limit reached, etc.)
   */
  applyUpgrade(upgrade: UpgradeDefinition): boolean {
    // Check if we can apply this upgrade
    if (!this.canApply(upgrade)) {
      console.warn(`Cannot apply upgrade ${upgrade.id}`)
      return false
    }

    // Handle based on upgrade type
    switch (upgrade.type) {
      case 'stat_modifier':
        this.applyStatModifier(upgrade)
        break

      case 'variant':
        this.applyVariant(upgrade)
        break

      case 'effect':
        this.applyEffect(upgrade)
        break

      case 'visual_effect':
        this.applyVisualEffect(upgrade)
        break

      case 'ability':
        this.applyAbility(upgrade)
        break
    }

    // Track the upgrade
    this.appliedUpgrades.set(upgrade.id, upgrade)

    // Increment stack count
    const currentStacks = this.stackCounts.get(upgrade.id) || 0
    this.stackCounts.set(upgrade.id, currentStacks + 1)

    // Emit event for UI updates
    EventBus.emit('upgrade-applied', upgrade.id)

    return true
  }

  /**
   * Check if an upgrade can be applied.
   */
  canApply(upgrade: UpgradeDefinition): boolean {
    // Check dependencies
    if (!this.canMeetDependencies(upgrade)) {
      return false
    }

    // Check incompatibilities
    if (upgrade.incompatibleWith && upgrade.incompatibleWith.length > 0) {
      for (const incompatibleId of upgrade.incompatibleWith) {
        if (this.hasUpgrade(incompatibleId)) {
          return false
        }
      }
    }

    // Check stack limit
    if (upgrade.stackable && upgrade.maxStacks) {
      const currentStacks = this.stackCounts.get(upgrade.id) || 0
      if (currentStacks >= upgrade.maxStacks) {
        return false
      }
    }

    // Check if not stackable and already applied
    if (!upgrade.stackable && this.appliedUpgrades.has(upgrade.id)) {
      return false
    }

    return true
  }

  /**
   * Check if an upgrade's dependencies are met.
   */
  private canMeetDependencies(upgrade: UpgradeDefinition): boolean {
    if (!upgrade.dependentOn || upgrade.dependentOn.length === 0) {
      return true
    }

    const required = upgrade.dependencyCount || 1
    let dependencyCount = 0

    for (const dependentId of upgrade.dependentOn) {
      // Check if this upgrade has been obtained
      if (this.hasUpgrade(dependentId)) {
        const stacks = this.stackCounts.get(dependentId) || 0
        dependencyCount += stacks > 0 ? 1 : 0 // Count as 1 even if multiple stacks
      }
    }

    return dependencyCount >= required
  }

  /**
   * Check if a specific upgrade has been obtained.
   * For variants, checks if it's the currently active variant.
   * For other upgrades, checks if it's in the applied list.
   */
  private hasUpgrade(upgradeId: string): boolean {
    // First check appliedUpgrades
    if (this.appliedUpgrades.has(upgradeId)) {
      const upgrade = this.appliedUpgrades.get(upgradeId)!
      // For variants, only count if it's still the active variant
      if (upgrade.type === 'variant') {
        return this.activeVariants.get(upgrade.target!) === upgrade.variantClass
      }
      // For other types, it's applied if it's in the map
      return true
    }
    return false
  }

  /**
   * Apply a stat modifier upgrade.
   */
  private applyStatModifier(upgrade: UpgradeDefinition): void {
    if (!upgrade.target || !upgrade.stat || upgrade.value === undefined) {
      console.error('Invalid stat_modifier upgrade:', upgrade)
      return
    }

    // Convert multiplier format: 1.50 -> 0.50 (for additive stacking)
    // Additive format: 5 stays as 5
    let modifierValue = upgrade.value
    if (upgrade.isMultiplier && modifierValue > 0) {
      // Convert from "multiply by X" to "add X-1" for percentage-based modifiers
      modifierValue = modifierValue
    }

    UpgradeModifierSystem.addModifier(
      upgrade.target,
      upgrade.stat,
      modifierValue,
      upgrade.isMultiplier || false
    )
  }

  /**
   * Apply a variant upgrade (changes projectile class).
   */
  private applyVariant(upgrade: UpgradeDefinition): void {
    if (!upgrade.target || !upgrade.variantClass) {
      console.error('Invalid variant upgrade:', upgrade)
      return
    }

    // Remove any conflicting variants
    if (upgrade.replaces) {
      for (const replacedId of upgrade.replaces) {
        this.removeUpgrade(replacedId)
      }
    }

    // Set the active variant for this target
    this.activeVariants.set(upgrade.target, upgrade.variantClass)
  }

  /**
   * Apply an effect upgrade (adds behavior).
   */
  private applyEffect(upgrade: UpgradeDefinition): void {
    if (!upgrade.effect) {
      console.error('Invalid effect upgrade:', upgrade)
      return
    }

    const value = upgrade.effectValue || upgrade.value || 0
    UpgradeEffectSystem.addEffect(upgrade.effect, value)
  }

  /**
   * Apply a visual effect upgrade.
   */
  private applyVisualEffect(upgrade: UpgradeDefinition): void {
    if (!upgrade.effect) {
      console.error('Invalid visual_effect upgrade:', upgrade)
      return
    }

    UpgradeEffectSystem.addVisualEffect(upgrade.effect, upgrade)
  }

  /**
   * Apply an ability upgrade.
   */
  private applyAbility(upgrade: UpgradeDefinition): void {
    if (!upgrade.effect) {
      console.error('Invalid ability upgrade:', upgrade)
      return
    }

    UpgradeEffectSystem.addAbility(upgrade.effect)
  }

  /**
   * Remove an upgrade.
   */
  removeUpgrade(upgradeId: string): void {
    const upgrade = this.appliedUpgrades.get(upgradeId)
    if (!upgrade) return

    // Remove from tracking
    this.appliedUpgrades.delete(upgradeId)
    this.stackCounts.delete(upgradeId)

    // Remove from systems based on type
    switch (upgrade.type) {
      case 'stat_modifier':
        if (upgrade.target && upgrade.stat) {
          UpgradeModifierSystem.removeModifier(upgrade.target, upgrade.stat)
        }
        break

      case 'variant':
        if (upgrade.target) {
          this.activeVariants.delete(upgrade.target)
        }
        break

      case 'effect':
        if (upgrade.effect) {
          UpgradeEffectSystem.removeEffect(upgrade.effect)
        }
        break

      case 'visual_effect':
        if (upgrade.effect) {
          UpgradeEffectSystem.removeVisualEffect(upgrade.effect)
        }
        break

      case 'ability':
        if (upgrade.effect) {
          UpgradeEffectSystem.removeAbility(upgrade.effect)
        }
        break
    }
  }

  /**
   * Subtract/decrement an upgrade (for dev tools).
   * For stackable upgrades, reduces stack by 1. For non-stackable, removes it.
   */
  decrementUpgrade(upgradeId: string): void {
    const upgrade = this.appliedUpgrades.get(upgradeId)
    if (!upgrade) return

    const stackCount = this.stackCounts.get(upgradeId) || 0

    if (upgrade.stackable && stackCount > 1) {
      // Decrement stack count
      this.stackCounts.set(upgradeId, stackCount - 1)

      // Reduce the effect/modifier by one stack's worth
      switch (upgrade.type) {
        case 'stat_modifier':
          if (upgrade.target && upgrade.stat && upgrade.value !== undefined) {
            UpgradeModifierSystem.removeModifier(upgrade.target, upgrade.stat)
            // Re-apply with reduced stacks
            const newStacks = stackCount - 1
            for (let i = 0; i < newStacks; i++) {
              UpgradeModifierSystem.addModifier(upgrade.target, upgrade.stat, upgrade.value, upgrade.isMultiplier || false)
            }
          }
          break

        case 'effect':
          if (upgrade.effect && upgrade.value !== undefined) {
            UpgradeEffectSystem.addEffect(upgrade.effect, -upgrade.value)
          }
          break
      }
    } else {
      // Remove completely (either non-stackable or last stack)
      this.removeUpgrade(upgradeId)
    }
  }

  /**
   * Get the active variant class for a target.
   * Returns null if no variant is active (use default class).
   */
  getVariant(target: string): string | null {
    return this.activeVariants.get(target) || null
  }

  /**
   * Get all modifiers for a target.
   */
  getModifiers(target: string): Map<string, number> {
    return UpgradeModifierSystem.getModifiers(target)
  }

  /**
   * Check if an effect is active.
   */
  hasEffect(effectId: string): boolean {
    return UpgradeEffectSystem.hasEffect(effectId)
  }

  /**
   * Get the total value of an effect (sum of all stacks).
   */
  getEffectValue(effectId: string): number {
    return UpgradeEffectSystem.getEffectValue(effectId)
  }

  /**
   * Get all applied upgrades.
   */
  getAppliedUpgrades(): UpgradeDefinition[] {
    return Array.from(this.appliedUpgrades.values())
  }

  /**
   * Get the stack count for an upgrade.
   */
  getStackCount(upgradeId: string): number {
    return this.stackCounts.get(upgradeId) || 0
  }

  /**
   * Reset all upgrades (for new game).
   */
  reset(): void {
    this.appliedUpgrades.clear()
    this.stackCounts.clear()
    this.activeVariants.clear()
    UpgradeModifierSystem.reset()
    UpgradeEffectSystem.reset()
  }
}

export const UpgradeSystem = new UpgradeSystemClass()
