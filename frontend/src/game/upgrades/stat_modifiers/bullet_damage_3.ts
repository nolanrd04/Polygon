import { Upgrade, type UpgradeDef } from '../Upgrade'
import { UpgradeTargetID, UpgradeStatID, RarityID, UpgradeTypeID } from '../../data/ID'

export const BulletDamage3Def: UpgradeDef = {
  id: "bullet_damage_3",
  name: "Sharper Rounds",
  description: "+8 bullet damage",
  rarity: RarityID.Rare,
  upgradeType: UpgradeTypeID.StatModifier,
  cost: 10,
  targetClass: UpgradeTargetID.Attack,
  fieldInTargetClass: UpgradeStatID.Damage,
  value: 8,
  isMultiplier: false,
  specificAttackType: "bullet",
  stackable: true,
  maxStacks: 99999,
}

export class BulletDamage3 extends Upgrade {}
