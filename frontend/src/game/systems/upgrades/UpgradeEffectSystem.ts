import { UpgradeDefinition } from './UpgradeSystem'

/**
 * Effect handler function signature
 */
export interface EffectHandler {
  onHit?: (projectile: any, enemy: any) => void
  onKill?: (enemy: any) => void
  onUpdate?: (deltaTime: number) => void
  onDamage?: (amount: number) => number // Modifies incoming damage
  onSpawn?: (entity: any) => void
}

/**
 * Manages gameplay effects from upgrades.
 * Effects are behaviors that trigger on events (onHit, onUpdate, etc.)
 */
class UpgradeEffectSystemClass {
  private effectHandlers: Map<string, EffectHandler> = new Map()
  private activeEffects: Map<string, number> = new Map() // effectId -> total value
  private visualEffects: Map<string, UpgradeDefinition> = new Map()
  private activeAbilities: Set<string> = new Set()

  /**
   * Register an effect handler.
   * This should be called once at game initialization.
   */
  registerEffect(effectId: string, handler: EffectHandler): void {
    this.effectHandlers.set(effectId, handler)
  }

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
  addVisualEffect(effectId: string, upgrade: UpgradeDefinition): void {
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
  getVisualEffect(effectId: string): UpgradeDefinition | undefined {
    return this.visualEffects.get(effectId)
  }

  /**
   * Add an ability.
   */
  addAbility(abilityId: string): void {
    this.activeAbilities.add(abilityId)
  }

  /**
   * Remove an ability.
   */
  removeAbility(abilityId: string): void {
    this.activeAbilities.delete(abilityId)
  }

  /**
   * Check if an ability is active.
   */
  hasAbility(abilityId: string): boolean {
    return this.activeAbilities.has(abilityId)
  }

  // ============================================================
  // EVENT TRIGGERS - Called by game systems
  // ============================================================

  /**
   * Trigger onHit effects when a projectile hits an enemy.
   */
  onProjectileHit(projectile: any, enemy: any): void {
    for (const [effectId, value] of this.activeEffects) {
      if (value <= 0) continue

      const handler = this.effectHandlers.get(effectId)
      if (handler?.onHit) {
        handler.onHit(projectile, enemy)
      }
    }
  }

  /**
   * Trigger onKill effects when an enemy is killed.
   */
  onEnemyKill(enemy: any): void {
    for (const [effectId, value] of this.activeEffects) {
      if (value <= 0) continue

      const handler = this.effectHandlers.get(effectId)
      if (handler?.onKill) {
        handler.onKill(enemy)
      }
    }
  }

  /**
   * Trigger onUpdate effects every frame.
   */
  onUpdate(deltaTime: number): void {
    for (const [effectId, value] of this.activeEffects) {
      if (value <= 0) continue

      const handler = this.effectHandlers.get(effectId)
      if (handler?.onUpdate) {
        handler.onUpdate(deltaTime)
      }
    }
  }

  /**
   * Trigger onDamage effects when player takes damage.
   * Returns the modified damage amount.
   */
  onPlayerDamage(amount: number): number {
    let modifiedAmount = amount

    for (const [effectId, value] of this.activeEffects) {
      if (value <= 0) continue

      const handler = this.effectHandlers.get(effectId)
      if (handler?.onDamage) {
        modifiedAmount = handler.onDamage(modifiedAmount)
      }
    }

    return modifiedAmount
  }

  /**
   * Trigger onSpawn effects when an entity is spawned.
   */
  onEntitySpawn(entity: any): void {
    for (const [effectId, value] of this.activeEffects) {
      if (value <= 0) continue

      const handler = this.effectHandlers.get(effectId)
      if (handler?.onSpawn) {
        handler.onSpawn(entity)
      }
    }
  }

  /**
   * Reset all effects.
   */
  reset(): void {
    this.activeEffects.clear()
    this.visualEffects.clear()
    this.activeAbilities.clear()
  }
}

export const UpgradeEffectSystem = new UpgradeEffectSystemClass()
