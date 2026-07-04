import { Upgrade, type UpgradeDef } from '../Upgrade'
import { UpgradeTargetID, UpgradeStatID, RarityID, UpgradeTypeID } from '../../data/ID'

export const DamageReduc3Def: UpgradeDef = {
  id: "damage_reduc_3",
  name: "Weakness 3",
  description: "-0.8% damage.",
  rarity: RarityID.Rare,
  upgradeType: UpgradeTypeID.StatModifier,
  cost: 0,
  targetClass: UpgradeTargetID.Attack,
  fieldInTargetClass: UpgradeStatID.Damage,
  value: -0.008,
  isMultiplier: true,
  stackable: true,
  maxStacks: 99999,
  curse: true,
}

export class DamageReduc3 extends Upgrade {}
