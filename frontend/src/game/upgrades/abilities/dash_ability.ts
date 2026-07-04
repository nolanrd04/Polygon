import { Upgrade, type UpgradeDef } from '../Upgrade'
import { RarityID, UpgradeTypeID } from '../../data/ID'

export const DashAbilityDef: UpgradeDef = {
  id: "dash_ability",
  name: "Dash",
  description: "Press SPACE to dash",
  rarity: RarityID.Rare,
  upgradeType: UpgradeTypeID.Ability,
  cost: 10,
  effect: "dash",
  stackable: false,
}

export class DashAbility extends Upgrade {}
