import { Upgrade, type UpgradeDef } from '../Upgrade'
import { UpgradeTargetID, UpgradeStatID, RarityID, UpgradeTypeID } from '../../data/ID'

export const BulletDamage5Def: UpgradeDef = {
  id: "bullet_damage_5",
  name: "Sharper Rounds",
  description: "+35 bullet damage",
  rarity: RarityID.Legendary,
  upgradeType: UpgradeTypeID.StatModifier,
  cost: 40,
  targetClass: UpgradeTargetID.Bullet,
  fieldInTargetClass: UpgradeStatID.Damage,
  value: 35,
  isMultiplier: false,
  specificAttackType: "bullet",
  stackable: true,
  maxStacks: 99999,
}

export class BulletDamage5 extends Upgrade {}
