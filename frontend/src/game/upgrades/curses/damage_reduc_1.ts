import { Upgrade, type UpgradeDef } from '../Upgrade'
import { UpgradeTargetID, UpgradeStatID, RarityID, UpgradeTypeID } from '../../data/ID'

export const DamageReduc1Def: UpgradeDef = {
  id: "damage_reduc_1",
  name: "Weakness 1",
  description: "-0.1% damage.",
  rarity: RarityID.Common,
  upgradeType: UpgradeTypeID.StatModifier,
  cost: 0,
  targetClass: UpgradeTargetID.Attack,
  fieldInTargetClass: UpgradeStatID.Damage,
  value: -0.001,
  isMultiplier: true,
  stackable: true,
  maxStacks: 99999,
  curse: true,
}

export class DamageReduc1 extends Upgrade {}
