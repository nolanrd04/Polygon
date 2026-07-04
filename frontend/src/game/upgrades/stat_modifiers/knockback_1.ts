import { Upgrade, type UpgradeDef } from '../Upgrade'
import { UpgradeTargetID, UpgradeStatID, RarityID, UpgradeTypeID } from '../../data/ID'

export const Knockback1Def: UpgradeDef = {
  id: "knockback_1",
  name: "Knockback Boost",
  description: "+5% knockback",
  rarity: RarityID.Common,
  upgradeType: UpgradeTypeID.StatModifier,
  cost: 2,
  targetClass: UpgradeTargetID.Attack,
  fieldInTargetClass: UpgradeStatID.Knockback,
  value: 0.05,
  isMultiplier: true,
  stackable: true,
  maxStacks: 5,
}

export class Knockback1 extends Upgrade {}
