import { Upgrade, type UpgradeDef, type UpgradeContext } from '../Upgrade'
import { UpgradeModifierSystem } from '../../systems/upgrades/UpgradeModifierSystem'
import { RarityID, UpgradeTypeID, UpgradeTargetID, UpgradeStatID } from '../../data/ID'
import { SparkParticle } from '../../../game/entities/particles/BasicParticles'
import { Particle } from '../../../game/entities/particles/Particle'

export const HealAbilityDef: UpgradeDef = {
  id: "heal_ability",
  name: "Field Repair",
  description: "Press X to restore 10% of max health",
  rarity: RarityID.Common,
  upgradeType: UpgradeTypeID.Ability,
  cost: 0,
  effect: "heal",
  // Fraction of max health restored per charge, before healAmount modifiers.
  // Scaling off max rather than a flat number keeps the heal meaningful as
  // player_health_* upgrades push maxHealth up.
  effectValue: 0.1,
  stackable: false,
  // Every run starts with this one — it is never offered or bought.
  starting: true,
  activation: {
    key: "X",
    label: "HEAL",
    buttonColor: 0xdd4466,
    theme: "rose",
    slot: 2,
    charges: 1,
    cooldown: 8000,
    cooldownStat: UpgradeStatID.HealCooldown,
  },
}

export class HealAbility extends Upgrade {
  onActivate(ctx: UpgradeContext): boolean {
    const stats = ctx.gameManager.getPlayerStats()
    // Declining at full health keeps the charge rather than burning it on a
    // heal that would be clamped away.
    if (stats.health >= stats.maxHealth) return false

    const fraction = UpgradeModifierSystem.applyModifiers(
      UpgradeTargetID.Player,
      UpgradeStatID.HealAmount,
      this.def.effectValue!
    )
    ctx.gameManager.heal(stats.maxHealth * fraction)

    if (ctx.player) {
      Particle.Burst(SparkParticle, ctx.player.x, ctx.player.y, Phaser.Math.Between(8, 12), {
        randomAngle: true,
        speed: 200,
        speedVariance: 0.2,
        color: 0x34eb49,
        timeLeft: 300,
        scale: 1,
        radius: Phaser.Math.FloatBetween(1.5, 3)
      })
    }
    return true
  }
}
