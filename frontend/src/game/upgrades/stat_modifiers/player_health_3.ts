import { Upgrade, type UpgradeDef } from '../Upgrade'
import { UpgradeTargetID, UpgradeStatID, RarityID, UpgradeTypeID } from '../../data/ID'

export const PlayerHealth3Def: UpgradeDef = {
  id: "player_health_3",
  name: "Reinforced Core",
  description: "+60 max health",
  rarity: RarityID.Rare,
  upgradeType: UpgradeTypeID.StatModifier,
  cost: 10,
  targetClass: UpgradeTargetID.Player,
  fieldInTargetClass: UpgradeStatID.MaxHealth,
  value: 60,
  stackable: true,
  maxStacks: 99999999,
}

export class PlayerHealth3 extends Upgrade {}
