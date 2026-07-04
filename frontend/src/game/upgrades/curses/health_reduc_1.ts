import { Upgrade, type UpgradeDef } from '../Upgrade'
import { UpgradeTargetID, UpgradeStatID, RarityID, UpgradeTypeID } from '../../data/ID'

export const HealthReduc1Def: UpgradeDef = {
  id: "health_reduc_1",
  name: "Reduced Health 1",
  description: "-5 max health.",
  rarity: RarityID.Common,
  upgradeType: UpgradeTypeID.StatModifier,
  cost: 0,
  targetClass: UpgradeTargetID.Player,
  fieldInTargetClass: UpgradeStatID.MaxHealth,
  value: -5,
  isMultiplier: false,
  stackable: true,
  maxStacks: 99999,
  curse: true,
}

export class HealthReduc1 extends Upgrade {}
