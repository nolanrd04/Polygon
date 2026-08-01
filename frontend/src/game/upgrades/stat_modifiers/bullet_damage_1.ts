import { Upgrade, type UpgradeDef } from '../Upgrade'
import { UpgradeTargetID, UpgradeStatID, RarityID, UpgradeTypeID, AttackTypeID } from '../../data/ID'

export const BulletDamage1Def: UpgradeDef = {
  id: "bullet_damage_1",
  name: "Sharper Rounds",
  description: "+1 bullet damage",
  rarity: RarityID.Common,
  upgradeType: UpgradeTypeID.StatModifier,
  cost: 2,
  targetClass: UpgradeTargetID.Bullet,
  fieldInTargetClass: UpgradeStatID.Damage,
  value: 1,
  isMultiplier: false,
  specificAttackType: AttackTypeID.Bullet,
  stackable: true,
  maxStacks: 99999,
}

export class BulletDamage1 extends Upgrade {}
