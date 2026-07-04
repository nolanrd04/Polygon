import { Upgrade, type UpgradeDef } from '../Upgrade'
import { UpgradeTargetID, UpgradeStatID, RarityID, UpgradeTypeID } from '../../data/ID'

export const HealthReduc5Def: UpgradeDef = {
  id: "health_reduc_5",
  name: "Reduced Health 5",
  description: "-80 max health.",
  rarity: RarityID.Legendary,
  upgradeType: UpgradeTypeID.StatModifier,
  cost: 0,
  targetClass: UpgradeTargetID.Player,
  fieldInTargetClass: UpgradeStatID.MaxHealth,
  value: -80,
  isMultiplier: false,
  stackable: true,
  maxStacks: 99999,
  curse: true,
}

export class HealthReduc5 extends Upgrade {}
