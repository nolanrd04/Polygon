import { Upgrade, type UpgradeDef } from '../Upgrade'
import { UpgradeTargetID, UpgradeStatID, RarityID, UpgradeTypeID } from '../../data/ID'

export const ShatteredBullet3Def: UpgradeDef = {
  id: "shattered_bullet_3",
  name: "Shattered Bullet 3",
  description: "-5 bullet damage.",
  rarity: RarityID.Epic,
  upgradeType: UpgradeTypeID.StatModifier,
  cost: 0,
  targetClass: UpgradeTargetID.Bullet,
  fieldInTargetClass: UpgradeStatID.Damage,
  value: -5,
  isMultiplier: false,
  stackable: true,
  maxStacks: 99999,
  curse: true,
}

export class ShatteredBullet3 extends Upgrade {}
