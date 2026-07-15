import { Upgrade, type UpgradeDef } from '../Upgrade'
import { UpgradeTargetID, UpgradeStatID, RarityID, UpgradeTypeID } from '../../data/ID'

export const DashCooldown2Def: UpgradeDef = {
  id: "dash_cooldown_2",
  name: "Swift Recovery",
  description: "-15% dash cooldown",
  rarity: RarityID.Epic,
  upgradeType: UpgradeTypeID.StatModifier,
  cost: 20,
  targetClass: UpgradeTargetID.Player,
  fieldInTargetClass: UpgradeStatID.DashCooldown,
  value: -0.15,
  isMultiplier: true,
  stackable: true,
  maxStacks: 3,
  dependentOn: [{ ids: ["dash_ability"] }],
}

export class DashCooldown2 extends Upgrade {}
