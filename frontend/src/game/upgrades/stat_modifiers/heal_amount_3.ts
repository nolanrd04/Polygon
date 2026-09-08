import { Upgrade, type UpgradeDef } from '../Upgrade'
import { UpgradeTargetID, UpgradeStatID, RarityID, UpgradeTypeID } from '../../data/ID'

export const HealAmount3Def: UpgradeDef = {
  id: "heal_amount_3",
  name: "Greater Healing",
  description: "+5% heal amount",
  rarity: RarityID.Legendary,
  upgradeType: UpgradeTypeID.StatModifier,
  cost: 40,
  targetClass: UpgradeTargetID.Player,
  fieldInTargetClass: UpgradeStatID.HealAmount,
  value: 0.05,
  isMultiplier: true,
  stackable: true,
  maxStacks: 2,
  dependentOn: [{ ids: ["heal_ability"] }],
}

export class HealAmount3 extends Upgrade {}
