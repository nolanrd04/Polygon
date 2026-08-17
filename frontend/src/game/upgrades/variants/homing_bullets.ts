import { Upgrade, type UpgradeDef } from '../Upgrade'
import { UpgradeTargetID, RarityID, UpgradeTypeID } from '../../data/ID'

export const HomingBulletsDef: UpgradeDef = {
  id: "homing_bullets",
  name: "Homing Bullets",
  description: "Bullets track nearest enemy and decay in damage over time. On colliding with an enemy, bullets reduce even further in damage. Bullets do no knockback.",
  rarity: RarityID.Epic,
  upgradeType: UpgradeTypeID.Variant,
  cost: 20,
  targetClass: UpgradeTargetID.Bullet,
  variantClass: "HomingBullet",
  replaces: ["explosive_bullets", "buckshot_bullets"],
  specificAttackType: "bullet",
  stackable: false,
  incompatibleWith: ["explosive_bullets", "buckshot_bullets"],
}

export class HomingBullets extends Upgrade {}
