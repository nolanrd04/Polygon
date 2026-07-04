import { Upgrade, type UpgradeDef } from '../Upgrade'
import { UpgradeTargetID, UpgradeStatID, RarityID, UpgradeTypeID } from '../../data/ID'

export const BulletSize1Def: UpgradeDef = {
  id: "bullet_size_1",
  name: "Heavy Rounds",
  description: "+10% bullet size",
  rarity: RarityID.Uncommon,
  upgradeType: UpgradeTypeID.StatModifier,
  cost: 6,
  targetClass: UpgradeTargetID.Bullet,
  fieldInTargetClass: UpgradeStatID.Size,
  value: 0.1,
  isMultiplier: true,
  specificAttackType: "bullet",
  stackable: true,
  maxStacks: 3,
}

export class BulletSize1 extends Upgrade {}
