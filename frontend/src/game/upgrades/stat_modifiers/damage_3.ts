import { Upgrade, type UpgradeDef } from '../Upgrade'
import { UpgradeTargetID, UpgradeStatID, RarityID, UpgradeTypeID } from '../../data/ID'

export const Damage3Def: UpgradeDef = {
  id: "damage_3",
  name: "Devastation",
  description: "+1.6% damage.",
  rarity: RarityID.Rare,
  upgradeType: UpgradeTypeID.StatModifier,
  cost: 10,
  targetClass: UpgradeTargetID.Attack,
  fieldInTargetClass: UpgradeStatID.Damage,
  value: 0.016,
  isMultiplier: true,
  stackable: true,
  maxStacks: 99999,
}

export class Damage3 extends Upgrade {}
