import { Upgrade, type UpgradeDef, type UpgradeContext } from '../Upgrade'
import { RarityID, UpgradeTypeID } from '../../data/ID'

export const ShieldAbilityDef: UpgradeDef = {
  id: "shield_ability",
  name: "Energy Shield",
  description: "Press E for temporary shield (consumable, stacks)",
  rarity: RarityID.Rare,
  upgradeType: UpgradeTypeID.Effect,
  cost: 10,
  value: 1,
  effect: "shield",
  stackable: true,
  maxStacks: 5,
  // No cooldown: charges are the consumable `shield` effect counter, spent in
  // Player.activateShield() and refilled only by buying another stack.
  activation: {
    key: "E",
    label: "SHIELD",
    buttonColor: 0x44dddd,
    theme: "cyan",
    slot: 0,
  },
}

export class ShieldAbility extends Upgrade {
  onActivate(ctx: UpgradeContext): boolean {
    return ctx.player?.activateShield() ?? false
  }
}
