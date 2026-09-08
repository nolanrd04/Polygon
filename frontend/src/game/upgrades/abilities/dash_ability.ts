import { Upgrade, type UpgradeDef, type UpgradeContext } from '../Upgrade'
import { RarityID, UpgradeTypeID, UpgradeStatID } from '../../data/ID'

export const DashAbilityDef: UpgradeDef = {
  id: "dash_ability",
  name: "Dash",
  description: "Press SPACE to dash",
  rarity: RarityID.Rare,
  upgradeType: UpgradeTypeID.Ability,
  cost: 10,
  effect: "dash",
  stackable: false,
  activation: {
    key: "SPACE",
    keyLabel: "SPC",
    label: "DASH",
    buttonColor: 0x44dd44,
    theme: "blue",
    slot: 1,
    charges: 1,
    cooldown: 1500,
    cooldownStat: UpgradeStatID.DashCooldown,
  },
}

export class DashAbility extends Upgrade {
  /** The burst itself stays on Player — it drives the physics body every
   *  frame. AbilitySystem owns everything around it (charges, cooldown). */
  onActivate(ctx: UpgradeContext): boolean {
    return ctx.player?.performDash() ?? false
  }
}
