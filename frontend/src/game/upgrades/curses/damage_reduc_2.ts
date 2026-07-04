import { Upgrade, type UpgradeDef } from '../Upgrade'
import { UpgradeTargetID, UpgradeStatID, RarityID, UpgradeTypeID } from '../../data/ID'

export const DamageReduc2Def: UpgradeDef = {
  id: "damage_reduc_2",
  name: "Weakness 2",
  description: "-0.4% damage.",
  rarity: RarityID.Uncommon,
  upgradeType: UpgradeTypeID.StatModifier,
  cost: 0,
  targetClass: UpgradeTargetID.Attack,
  fieldInTargetClass: UpgradeStatID.Damage,
  value: -0.004,
  isMultiplier: true,
  stackable: true,
  maxStacks: 99999,
  curse: true,
}

export class DamageReduc2 extends Upgrade {}
