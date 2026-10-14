import { Upgrade, type UpgradeDef } from '../Upgrade'
import { UpgradeTargetID, UpgradeStatID, RarityID, UpgradeTypeID, IconID } from '../../data/ID'

export const Knockback3Def: UpgradeDef = {
  id: "knockback_3",
  name: "Knockback Boost",
  description: "+50% knockback",
  rarity: RarityID.Rare,
  upgradeType: UpgradeTypeID.StatModifier,
  cost: 10,
  targetClass: UpgradeTargetID.Attack,
  fieldInTargetClass: UpgradeStatID.Knockback,
  value: 0.5,
  isMultiplier: true,
  stackable: true,
  maxStacks: 2,
  incompatibleWith: ["homing_bullets"],
  icon: IconID.Knockback
}

export class Knockback3 extends Upgrade {}
