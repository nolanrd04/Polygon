import { Upgrade, type UpgradeDef } from '../Upgrade'
import { UpgradeTargetID, UpgradeStatID, RarityID, UpgradeTypeID } from '../../data/ID'

export const HealthReduc3Def: UpgradeDef = {
  id: "health_reduc_3",
  name: "Reduced Health 3",
  description: "-20 max health.",
  rarity: RarityID.Rare,
  upgradeType: UpgradeTypeID.StatModifier,
  cost: 0,
  targetClass: UpgradeTargetID.Player,
  fieldInTargetClass: UpgradeStatID.MaxHealth,
  value: -20,
  isMultiplier: false,
  stackable: true,
  maxStacks: 99999,
  curse: true,
}

export class HealthReduc3 extends Upgrade {}
