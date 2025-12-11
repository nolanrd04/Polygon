import { UpgradeEffectSystem } from './UpgradeEffectSystem'
import { GameManager } from '../../core/GameManager'
import { EventBus } from '../../core/EventBus'

/**
 * Register all effect handlers.
 * This should be called once at game initialization.
 */
export function registerEffectHandlers(): void {
  // ============================================================
  // LIFESTEAL - Heal when dealing damage
  // ============================================================
  UpgradeEffectSystem.registerEffect('lifesteal', {
    onHit: (projectile: any, _enemy: any) => {
      const percent = UpgradeEffectSystem.getEffectValue('lifesteal')
      const healAmount = projectile.damage * percent
      GameManager.heal(healAmount)
    }
  })

  // ============================================================
  // REGENERATION - Heal over time
  // ============================================================
  UpgradeEffectSystem.registerEffect('regen', {
    onUpdate: (deltaTime: number) => {
      const hps = UpgradeEffectSystem.getEffectValue('regen')
      const healAmount = hps * (deltaTime / 1000)
      GameManager.heal(healAmount)
    }
  })

  // ============================================================
  // ARMOR - Reduce incoming damage
  // ============================================================
  UpgradeEffectSystem.registerEffect('armor', {
    onDamage: (amount: number) => {
      const reduction = UpgradeEffectSystem.getEffectValue('armor')
      return Math.max(1, amount * (1 - reduction)) // Always deal at least 1 damage
    }
  })

  // ============================================================
  // THORNS - Reflect damage back to enemies
  // ============================================================
  UpgradeEffectSystem.registerEffect('thorns', {
    onDamage: (amount: number) => {
      const percent = UpgradeEffectSystem.getEffectValue('thorns')
      const reflectAmount = amount * percent

      // Emit event to apply reflected damage to nearby enemies
      // The scene will handle finding and damaging nearby enemies
      EventBus.emit('thorns-reflect', { damage: reflectAmount })

      return amount // Thorns doesn't reduce incoming damage
    }
  })

  // ============================================================
  // EXPLODE ON KILL - Enemies explode when killed
  // ============================================================
  UpgradeEffectSystem.registerEffect('explode_on_kill', {
    onKill: (enemy: any) => {
      const damage = UpgradeEffectSystem.getEffectValue('explode_on_kill')

      // Emit event for explosion effect
      // The scene will handle creating the visual and dealing AOE damage
      enemy.scene?.events.emit('enemy-explode', {
        x: enemy.x,
        y: enemy.y,
        radius: 60,
        damage: damage
      })
    }
  })

  // ============================================================
  // MULTISHOT - Fire additional projectiles
  // ============================================================
  // Note: Multishot is handled in Player.ts shoot() method
  // The effect system just tracks the count

  // ============================================================
  // DASH ABILITY - Quick movement
  // ============================================================
  // Abilities are tracked by UpgradeEffectSystem.hasAbility('dash')
  // The actual implementation is in Player.ts or MainScene.ts

  // ============================================================
  // SHIELD ABILITY - Temporary invulnerability
  // ============================================================
  // Tracked by hasAbility('shield')
  // Implementation in Player.ts

  // ============================================================
  // TIME SLOW ABILITY - Slow down time
  // ============================================================
  // Tracked by hasAbility('time_slow')
  // Implementation in MainScene.ts
}
