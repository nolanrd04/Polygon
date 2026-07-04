import { Upgrade, type UpgradeDef } from '../Upgrade'
import { UpgradeTargetID, UpgradeStatID, RarityID, UpgradeTypeID } from '../../data/ID'

export const HealthReduc4Def: UpgradeDef = {
  id: "health_reduc_4",
  name: "Reduced Health 4",
  description: "-40 max health.",
  rarity: RarityID.Epic,
  upgradeType: UpgradeTypeID.StatModifier,
  cost: 0,
  targetClass: UpgradeTargetID.Player,
  fieldInTargetClass: UpgradeStatID.MaxHealth,
  value: -40,
  isMultiplier: false,
  stackable: true,
  maxStacks: 99999,
  curse: true,
}

export class HealthReduc4 extends Upgrade {}
