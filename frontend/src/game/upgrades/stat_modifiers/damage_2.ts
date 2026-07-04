import { Upgrade, type UpgradeDef } from '../Upgrade'
import { UpgradeTargetID, UpgradeStatID, RarityID, UpgradeTypeID } from '../../data/ID'

export const Damage2Def: UpgradeDef = {
  id: "damage_2",
  name: "Devastation",
  description: "+0.8% damage.",
  rarity: RarityID.Uncommon,
  upgradeType: UpgradeTypeID.StatModifier,
  cost: 6,
  targetClass: UpgradeTargetID.Attack,
  fieldInTargetClass: UpgradeStatID.Damage,
  value: 0.008,
  isMultiplier: true,
  stackable: true,
  maxStacks: 99999,
}

export class Damage2 extends Upgrade {}
