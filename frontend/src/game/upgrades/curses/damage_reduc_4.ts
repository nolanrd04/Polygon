import { Upgrade, type UpgradeDef } from '../Upgrade'
import { UpgradeTargetID, UpgradeStatID, RarityID, UpgradeTypeID } from '../../data/ID'

export const DamageReduc4Def: UpgradeDef = {
  id: "damage_reduc_4",
  name: "Weakness 4",
  description: "-1.75% damage.",
  rarity: RarityID.Epic,
  upgradeType: UpgradeTypeID.StatModifier,
  cost: 0,
  targetClass: UpgradeTargetID.Attack,
  fieldInTargetClass: UpgradeStatID.Damage,
  value: -0.0175,
  isMultiplier: true,
  stackable: true,
  maxStacks: 99999,
  curse: true,
}

export class DamageReduc4 extends Upgrade {}
