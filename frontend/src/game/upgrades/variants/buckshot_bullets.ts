import { Upgrade, type UpgradeDef } from '../Upgrade'
import { UpgradeTargetID, RarityID, UpgradeTypeID, IconID } from '../../data/ID'

export const BuckshotBulletsDef: UpgradeDef = {
  id: "buckshot_bullets",
  name: "Buckshot Bullets",
  description: "Fires smaller, less-powerful pellets in a spread pattern. Pellets ignore 15 defense.",
  rarity: RarityID.Epic,
  upgradeType: UpgradeTypeID.Variant,
  cost: 20,
  targetClass: UpgradeTargetID.Bullet,
  variantClass: "BuckshotBullet",
  replaces: ["homing_bullets", "explosive_bullets"],
  specificAttackType: "bullet",
  stackable: false,
  incompatibleWith: ["homing_bullets", "explosive_bullets"],
  icon: IconID.Buckshot,
}

export class BuckshotBullets extends Upgrade 
{
}