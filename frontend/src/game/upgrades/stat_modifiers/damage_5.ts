import { Upgrade, type UpgradeDef } from '../Upgrade'
import { UpgradeTargetID, UpgradeStatID, RarityID, UpgradeTypeID } from '../../data/ID'

export const Damage5Def: UpgradeDef = {
  id: "damage_5",
  name: "Devastation",
  description: "+7.5% damage.",
  rarity: RarityID.Legendary,
  upgradeType: UpgradeTypeID.StatModifier,
  cost: 40,
  targetClass: UpgradeTargetID.Attack,
  fieldInTargetClass: UpgradeStatID.Damage,
  value: 0.075,
  isMultiplier: true,
  stackable: true,
  maxStacks: 99999,
}

export class Damage5 extends Upgrade {}
