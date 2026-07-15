import { Upgrade, type UpgradeDef } from '../Upgrade'
import { UpgradeTargetID, UpgradeStatID, RarityID, UpgradeTypeID } from '../../data/ID'

export const DashSpeed2Def: UpgradeDef = {
  id: "dash_speed_2",
  name: "Swift Escape",
  description: "+32% dash speed",
  rarity: RarityID.Epic,
  upgradeType: UpgradeTypeID.StatModifier,
  cost: 20,
  targetClass: UpgradeTargetID.Player,
  fieldInTargetClass: UpgradeStatID.DashSpeed,
  value: 0.32,
  isMultiplier: true,
  stackable: true,
  maxStacks: 2,
  dependentOn: [{ ids: ["dash_ability"] }],
}

export class DashSpeed2 extends Upgrade {}
