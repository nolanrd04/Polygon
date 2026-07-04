import { Upgrade, type UpgradeDef } from '../Upgrade'
import { UpgradeTargetID, UpgradeStatID, RarityID, UpgradeTypeID } from '../../data/ID'

export const BulletSpeed1Def: UpgradeDef = {
  id: "bullet_speed_1",
  name: "Velocity Boost",
  description: "+5% bullet speed",
  rarity: RarityID.Common,
  upgradeType: UpgradeTypeID.StatModifier,
  cost: 2,
  targetClass: UpgradeTargetID.Bullet,
  fieldInTargetClass: UpgradeStatID.Speed,
  value: 0.05,
  isMultiplier: true,
  specificAttackType: "bullet",
  stackable: true,
  maxStacks: 5,
}

export class BulletSpeed1 extends Upgrade {}
