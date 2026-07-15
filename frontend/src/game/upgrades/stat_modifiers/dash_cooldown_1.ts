import { Upgrade, type UpgradeDef } from '../Upgrade'
import { UpgradeTargetID, UpgradeStatID, RarityID, UpgradeTypeID } from '../../data/ID'

export const DashCooldown1Def: UpgradeDef = {
  id: "dash_cooldown_1",
  name: "Swift Recovery",
  description: "-5% dash cooldown",
  rarity: RarityID.Rare,
  upgradeType: UpgradeTypeID.StatModifier,
  cost: 10,
  targetClass: UpgradeTargetID.Player,
  fieldInTargetClass: UpgradeStatID.DashCooldown,
  value: -0.05,
  isMultiplier: true,
  stackable: true,
  maxStacks: 5,
  dependentOn: [{ ids: ["dash_ability"] }],
}

export class DashCooldown1 extends Upgrade {}
