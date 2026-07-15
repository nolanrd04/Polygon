import { Upgrade, type UpgradeDef } from '../Upgrade'
import { UpgradeTargetID, UpgradeStatID, RarityID, UpgradeTypeID } from '../../data/ID'

export const DashSpeed1Def: UpgradeDef = {
  id: "dash_speed_1",
  name: "Swift Escape",
  description: "+15% dash speed",
  rarity: RarityID.Rare,
  upgradeType: UpgradeTypeID.StatModifier,
  cost: 10,
  targetClass: UpgradeTargetID.Player,
  fieldInTargetClass: UpgradeStatID.DashSpeed,
  value: 0.15,
  isMultiplier: true,
  stackable: true,
  maxStacks: 3,
  dependentOn: [{ ids: ["dash_ability"] }],
}

export class DashSpeed1 extends Upgrade {}
