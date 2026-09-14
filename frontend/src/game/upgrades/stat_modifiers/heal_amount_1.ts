import { Upgrade, type UpgradeDef } from '../Upgrade'
import { UpgradeTargetID, UpgradeStatID, RarityID, UpgradeTypeID } from '../../data/ID'

export const HealAmount1Def: UpgradeDef = {
  id: "heal_amount_1",
  name: "Greater Healing",
  description: "+2% heal amount",
  rarity: RarityID.Uncommon,
  upgradeType: UpgradeTypeID.StatModifier,
  cost: 6,
  targetClass: UpgradeTargetID.Player,
  fieldInTargetClass: UpgradeStatID.HealAmount,
  value: 0.02,
  isMultiplier: true,
  stackable: true,
  maxStacks: 9,
  dependentOn: [{ ids: ["heal_ability"] }],
}

export class HealAmount1 extends Upgrade {}
