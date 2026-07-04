import { Upgrade, type UpgradeDef } from '../Upgrade'
import { UpgradeTargetID, UpgradeStatID, RarityID, UpgradeTypeID } from '../../data/ID'

export const Tenacity3Def: UpgradeDef = {
  id: "tenacity_3",
  name: "Tenacity",
  description: "Increased the bullet lifespan by 1 second",
  rarity: RarityID.Legendary,
  upgradeType: UpgradeTypeID.StatModifier,
  cost: 40,
  targetClass: UpgradeTargetID.Bullet,
  fieldInTargetClass: UpgradeStatID.TimeLeft,
  value: 1000,
  specificAttackType: "bullet",
  stackable: true,
  maxStacks: 1,
}

export class Tenacity3 extends Upgrade {}
