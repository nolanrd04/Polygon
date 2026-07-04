import { Upgrade, type UpgradeDef } from '../Upgrade'
import { UpgradeTargetID, UpgradeStatID, RarityID, UpgradeTypeID } from '../../data/ID'

export const BulletDamage4Def: UpgradeDef = {
  id: "bullet_damage_4",
  name: "Sharper Rounds",
  description: "+16 bullet damage",
  rarity: RarityID.Epic,
  upgradeType: UpgradeTypeID.StatModifier,
  cost: 20,
  targetClass: UpgradeTargetID.Attack,
  fieldInTargetClass: UpgradeStatID.Damage,
  value: 16,
  isMultiplier: false,
  specificAttackType: "bullet",
  stackable: true,
  maxStacks: 99999,
}

export class BulletDamage4 extends Upgrade {}
