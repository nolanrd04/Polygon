import { Upgrade, type UpgradeDef } from '../Upgrade'
import { UpgradeTargetID, UpgradeStatID, RarityID, UpgradeTypeID } from '../../data/ID'

export const PlayerHealth2Def: UpgradeDef = {
  id: "player_health_2",
  name: "Reinforced Core",
  description: "+30 max health",
  rarity: RarityID.Uncommon,
  upgradeType: UpgradeTypeID.StatModifier,
  cost: 6,
  targetClass: UpgradeTargetID.Player,
  fieldInTargetClass: UpgradeStatID.MaxHealth,
  value: 30,
  stackable: true,
  maxStacks: 99999999,
}

export class PlayerHealth2 extends Upgrade {}
