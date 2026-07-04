import { Upgrade, type UpgradeDef } from '../Upgrade'
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
}

export class ShieldAbility extends Upgrade {}
