import { Upgrade, type UpgradeDef } from '../Upgrade'
import { UpgradeTargetID, UpgradeStatID, RarityID, UpgradeTypeID, IconID } from '../../data/ID'

export const PlayerSpeed1Def: UpgradeDef = {
  id: "player_speed_1",
  name: "Thruster Boost",
  description: "+10 movement speed",
  rarity: RarityID.Uncommon,
  upgradeType: UpgradeTypeID.StatModifier,
  cost: 6,
  targetClass: UpgradeTargetID.Player,
  fieldInTargetClass: UpgradeStatID.Speed,
  value: 10,
  stackable: true,
  maxStacks: 10,
  icon: IconID.Haste
}

export class PlayerSpeed1 extends Upgrade {}
