import { Upgrade, type UpgradeDef } from '../Upgrade'
import { UpgradeTargetID, UpgradeStatID, RarityID, UpgradeTypeID, IconID } from '../../data/ID'

export const BulletPierce2Def: UpgradeDef = {
  id: "bullet_pierce_2",
  name: "Piercing Shot II",
  description: "Bullets pierce +1 enemies",
  rarity: RarityID.Epic,
  upgradeType: UpgradeTypeID.StatModifier,
  cost: 20,
  targetClass: UpgradeTargetID.Bullet,
  fieldInTargetClass: UpgradeStatID.Pierce,
  value: 1,
  specificAttackType: "bullet",
  stackable: true,
  maxStacks: 1,
  icon: IconID.Pierce,
  tier: 2,
  dependentOn: [
    { ids: [{id: "polygon_upgrade", minStacks: 2}] },
    { ids: [{id: "bullet_pierce_1", minStacks: 1}] }
  ]
}

export class BulletPierce2 extends Upgrade {}
