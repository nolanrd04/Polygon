import { Upgrade, type UpgradeDef } from '../Upgrade'
import { UpgradeTargetID, UpgradeStatID, RarityID, UpgradeTypeID, AttackTypeID, IconID } from '../../data/ID'

export const BulletDamage2Def: UpgradeDef = {
  id: "bullet_damage_2",
  name: "Sharper Rounds",
  description: "+4 bullet damage",
  rarity: RarityID.Uncommon,
  upgradeType: UpgradeTypeID.StatModifier,
  cost: 6,
  targetClass: UpgradeTargetID.Bullet,
  fieldInTargetClass: UpgradeStatID.Damage,
  value: 4,
  isMultiplier: false,
  specificAttackType: AttackTypeID.Bullet,
  stackable: true,
  maxStacks: 99999,
  icon: IconID.ShinyBullet
}

export class BulletDamage2 extends Upgrade {}
