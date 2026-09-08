import { Upgrade, type UpgradeDef } from '../Upgrade'
import { UpgradeTargetID, UpgradeStatID, RarityID, UpgradeTypeID } from '../../data/ID'

export const HealAmount2Def: UpgradeDef = {
  id: "heal_amount_2",
  name: "Greater Healing",
  description: "+3% heal amount",
  rarity: RarityID.Epic,
  upgradeType: UpgradeTypeID.StatModifier,
  cost: 20,
  targetClass: UpgradeTargetID.Player,
  fieldInTargetClass: UpgradeStatID.HealAmount,
  value: 0.03,
  isMultiplier: true,
  stackable: true,
  maxStacks: 3,
  dependentOn: [{ ids: ["heal_ability"] }],
}

export class HealAmount2 extends Upgrade {}
