import { Upgrade, type UpgradeDef } from '../Upgrade'
import { UpgradeTargetID, UpgradeStatID, RarityID, UpgradeTypeID } from '../../data/ID'

export const ShatteredBullet1Def: UpgradeDef = {
  id: "shattered_bullet_1",
  name: "Shattered Bullet 1",
  description: "-1 bullet damage.",
  rarity: RarityID.Uncommon,
  upgradeType: UpgradeTypeID.StatModifier,
  cost: 0,
  targetClass: UpgradeTargetID.Bullet,
  fieldInTargetClass: UpgradeStatID.Damage,
  value: -1,
  isMultiplier: false,
  stackable: true,
  maxStacks: 99999,
  curse: true,
}

export class ShatteredBullet1 extends Upgrade {}
