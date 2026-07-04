import { Upgrade, type UpgradeDef } from '../Upgrade'
import { UpgradeTargetID, UpgradeStatID, RarityID, UpgradeTypeID } from '../../data/ID'

export const Tenacity1Def: UpgradeDef = {
  id: "tenacity_1",
  name: "Tenacity",
  description: "Increased the bullet lifespan by .15 seconds",
  rarity: RarityID.Rare,
  upgradeType: UpgradeTypeID.StatModifier,
  cost: 10,
  targetClass: UpgradeTargetID.Bullet,
  fieldInTargetClass: UpgradeStatID.TimeLeft,
  value: 150,
  specificAttackType: "bullet",
  stackable: true,
  maxStacks: 6,
}

export class Tenacity1 extends Upgrade {}
