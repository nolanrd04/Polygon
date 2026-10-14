import { Upgrade, type UpgradeDef } from '../Upgrade'
import { UpgradeTargetID, UpgradeStatID, RarityID, UpgradeTypeID, IconID } from '../../data/ID'

export const Knockback2Def: UpgradeDef = {
  id: "knockback_2",
  name: "Knockback Boost",
  description: "+20% knockback",
  rarity: RarityID.Uncommon,
  upgradeType: UpgradeTypeID.StatModifier,
  cost: 6,
  targetClass: UpgradeTargetID.Attack,
  fieldInTargetClass: UpgradeStatID.Knockback,
  value: 0.2,
  isMultiplier: true,
  stackable: true,
  maxStacks: 3,
  incompatibleWith: ["homing_bullets"],
  icon: IconID.Knockback
}

export class Knockback2 extends Upgrade {}
