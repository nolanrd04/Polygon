import { Upgrade, type UpgradeDef } from '../Upgrade'
import { UpgradeTargetID, UpgradeStatID, RarityID, UpgradeTypeID } from '../../data/ID'

export const PlayerHealth5Def: UpgradeDef = {
  id: "player_health_5",
  name: "Reinforced Core",
  description: "+300 max health",
  rarity: RarityID.Legendary,
  upgradeType: UpgradeTypeID.StatModifier,
  cost: 40,
  targetClass: UpgradeTargetID.Player,
  fieldInTargetClass: UpgradeStatID.MaxHealth,
  value: 300,
  stackable: true,
  maxStacks: 99999999,
}

export class PlayerHealth5 extends Upgrade {}
