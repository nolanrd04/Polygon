import { Upgrade, type UpgradeDef } from '../Upgrade'
import { UpgradeTargetID, RarityID, UpgradeTypeID } from '../../data/ID'

export const ExplosiveBulletsDef: UpgradeDef = {
  id: "explosive_bullets",
  name: "Explosive Bullets",
  description: "Bullets explode on impact dealing collision and area damage.",
  rarity: RarityID.Epic,
  upgradeType: UpgradeTypeID.Variant,
  cost: 20,
  targetClass: UpgradeTargetID.Bullet,
  variantClass: "ExplosiveBullet",
  replaces: ["homing_bullets", "buckshot_bullets"],
  specificAttackType: "bullet",
  stackable: false,
  incompatibleWith: ["homing_bullets", "buckshot_bullets"],
}

export class ExplosiveBullets extends Upgrade {}
