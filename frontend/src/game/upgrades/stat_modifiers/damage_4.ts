import { Upgrade, type UpgradeDef } from '../Upgrade'
import { UpgradeTargetID, UpgradeStatID, RarityID, UpgradeTypeID } from '../../data/ID'

export const Damage4Def: UpgradeDef = {
  id: "damage_4",
  name: "Devastation",
  description: "+3.5% damage.",
  rarity: RarityID.Epic,
  upgradeType: UpgradeTypeID.StatModifier,
  cost: 20,
  targetClass: UpgradeTargetID.Attack,
  fieldInTargetClass: UpgradeStatID.Damage,
  value: 0.035,
  isMultiplier: true,
  stackable: true,
  maxStacks: 99999,
}

export class Damage4 extends Upgrade {}
