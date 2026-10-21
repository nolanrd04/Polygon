import { Upgrade, type UpgradeDef } from '../Upgrade'
import { UpgradeTargetID, UpgradeStatID, RarityID, UpgradeTypeID, IconID } from '../../data/ID'

export const BulletPierce1Def: UpgradeDef = {
  id: "bullet_pierce_1",
  name: "Piercing Shot I",
  description: "Bullets pierce +1 enemy",
  rarity: RarityID.Rare,
  upgradeType: UpgradeTypeID.StatModifier,
  cost: 10,
  targetClass: UpgradeTargetID.Bullet,
  fieldInTargetClass: UpgradeStatID.Pierce,
  value: 1,
  specificAttackType: "bullet",
  stackable: true,
  maxStacks: 1,
  icon: IconID.Pierce,
  tier: 1,
  upgradesTo: "bullet_pierce_2",
  dependentOn: [{ ids: [{id: "polygon_upgrade", minStacks: 1}] }],
}

export class BulletPierce1 extends Upgrade {}
