import { Upgrade, type UpgradeDef } from '../Upgrade'
import { UpgradeTargetID, UpgradeStatID, RarityID, UpgradeTypeID } from '../../data/ID'

export const BulletSize2Def: UpgradeDef = {
  id: "bullet_size_2",
  name: "Heavy Rounds",
  description: "+25% bullet size",
  rarity: RarityID.Rare,
  upgradeType: UpgradeTypeID.StatModifier,
  cost: 10,
  targetClass: UpgradeTargetID.Bullet,
  fieldInTargetClass: UpgradeStatID.Size,
  value: 0.25,
  isMultiplier: true,
  specificAttackType: "bullet",
  stackable: true,
  maxStacks: 2,
}

export class BulletSize2 extends Upgrade {}
