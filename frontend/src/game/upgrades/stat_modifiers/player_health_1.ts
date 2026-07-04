import { Upgrade, type UpgradeDef } from '../Upgrade'
import { UpgradeTargetID, UpgradeStatID, RarityID, UpgradeTypeID } from '../../data/ID'

export const PlayerHealth1Def: UpgradeDef = {
  id: "player_health_1",
  name: "Reinforced Core",
  description: "+10 max health",
  rarity: RarityID.Common,
  upgradeType: UpgradeTypeID.StatModifier,
  cost: 2,
  targetClass: UpgradeTargetID.Player,
  fieldInTargetClass: UpgradeStatID.MaxHealth,
  value: 10,
  stackable: true,
  maxStacks: 20,
}

export class PlayerHealth1 extends Upgrade {}
