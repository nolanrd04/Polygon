import { Upgrade, type UpgradeDef } from '../Upgrade'
import { UpgradeTargetID, UpgradeStatID, RarityID, UpgradeTypeID } from '../../data/ID'

export const PlayerHealth4Def: UpgradeDef = {
  id: "player_health_4",
  name: "Reinforced Core",
  description: "+130 max health",
  rarity: RarityID.Epic,
  upgradeType: UpgradeTypeID.StatModifier,
  cost: 20,
  targetClass: UpgradeTargetID.Player,
  fieldInTargetClass: UpgradeStatID.MaxHealth,
  value: 130,
  stackable: true,
  maxStacks: 99999999,
}

export class PlayerHealth4 extends Upgrade {}
