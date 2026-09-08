import { Upgrade, type UpgradeDef } from '../Upgrade'
import { UpgradeTargetID, UpgradeStatID, RarityID, UpgradeTypeID } from '../../data/ID'

export const HealCooldown2Def: UpgradeDef = {
  id: "heal_cooldown_2",
  name: "Quicker Fix",
  description: "-10% heal cooldown",
  rarity: RarityID.Epic,
  upgradeType: UpgradeTypeID.StatModifier,
  cost: 20,
  targetClass: UpgradeTargetID.Player,
  fieldInTargetClass: UpgradeStatID.HealCooldown,
  value: -0.1,
  isMultiplier: true,
  stackable: true,
  maxStacks: 2,
  dependentOn: [{ ids: ["heal_ability"] }],
}

export class HealCooldown2 extends Upgrade {}
