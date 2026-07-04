import { Upgrade, type UpgradeDef } from '../Upgrade'
import { UpgradeTargetID, UpgradeStatID, RarityID, UpgradeTypeID } from '../../data/ID'

export const Tenacity2Def: UpgradeDef = {
  id: "tenacity_2",
  name: "Tenacity",
  description: "Increased the bullet lifespan by .4 seconds",
  rarity: RarityID.Epic,
  upgradeType: UpgradeTypeID.StatModifier,
  cost: 20,
  targetClass: UpgradeTargetID.Bullet,
  fieldInTargetClass: UpgradeStatID.TimeLeft,
  value: 400,
  specificAttackType: "bullet",
  stackable: true,
  maxStacks: 3,
}

export class Tenacity2 extends Upgrade {}
