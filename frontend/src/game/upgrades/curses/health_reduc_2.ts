import { Upgrade, type UpgradeDef } from '../Upgrade'
import { UpgradeTargetID, UpgradeStatID, RarityID, UpgradeTypeID } from '../../data/ID'

export const HealthReduc2Def: UpgradeDef = {
  id: "health_reduc_2",
  name: "Reduced Health 2",
  description: "-10 max health.",
  rarity: RarityID.Uncommon,
  upgradeType: UpgradeTypeID.StatModifier,
  cost: 0,
  targetClass: UpgradeTargetID.Player,
  fieldInTargetClass: UpgradeStatID.MaxHealth,
  value: -10,
  isMultiplier: false,
  stackable: true,
  maxStacks: 99999,
  curse: true,
}

export class HealthReduc2 extends Upgrade {}
