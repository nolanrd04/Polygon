import { Upgrade, type UpgradeDef } from '../Upgrade'
import { UpgradeTargetID, UpgradeStatID, RarityID, UpgradeTypeID } from '../../data/ID'

export const Damage1Def: UpgradeDef = {
  id: "damage_1",
  name: "Devastation",
  description: "+0.2% damage.",
  rarity: RarityID.Common,
  upgradeType: UpgradeTypeID.StatModifier,
  cost: 2,
  targetClass: UpgradeTargetID.Attack,
  fieldInTargetClass: UpgradeStatID.Damage,
  value: 0.002,
  isMultiplier: true,
  stackable: true,
  maxStacks: 99999,
}

export class Damage1 extends Upgrade {}
