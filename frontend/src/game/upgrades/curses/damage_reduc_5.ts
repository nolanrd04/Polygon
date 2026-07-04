import { Upgrade, type UpgradeDef } from '../Upgrade'
import { UpgradeTargetID, UpgradeStatID, RarityID, UpgradeTypeID } from '../../data/ID'

export const DamageReduc5Def: UpgradeDef = {
  id: "damage_reduc_5",
  name: "Weakness 5",
  description: "-3.75% damage.",
  rarity: RarityID.Legendary,
  upgradeType: UpgradeTypeID.StatModifier,
  cost: 0,
  targetClass: UpgradeTargetID.Attack,
  fieldInTargetClass: UpgradeStatID.Damage,
  value: -0.0375,
  isMultiplier: true,
  stackable: true,
  maxStacks: 99999,
  curse: true,
}

export class DamageReduc5 extends Upgrade {}
