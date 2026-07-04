import { Upgrade, type UpgradeDef } from '../Upgrade'
import { UpgradeTargetID, UpgradeStatID, RarityID, UpgradeTypeID } from '../../data/ID'

export const ShatteredBullet2Def: UpgradeDef = {
  id: "shattered_bullet_2",
  name: "Shattered Bullet 2",
  description: "-3 bullet damage.",
  rarity: RarityID.Rare,
  upgradeType: UpgradeTypeID.StatModifier,
  cost: 0,
  targetClass: UpgradeTargetID.Bullet,
  fieldInTargetClass: UpgradeStatID.Damage,
  value: -3,
  isMultiplier: false,
  stackable: true,
  maxStacks: 99999,
  curse: true,
}

export class ShatteredBullet2 extends Upgrade {}
