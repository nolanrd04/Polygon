import { Upgrade, type UpgradeDef } from '../Upgrade'
import { UpgradeTargetID, UpgradeStatID, RarityID, UpgradeTypeID } from '../../data/ID'

export const HealCooldown1Def: UpgradeDef = {
  id: "heal_cooldown_1",
  name: "Quicker Fix",
  description: "-4% heal cooldown",
  rarity: RarityID.Rare,
  upgradeType: UpgradeTypeID.StatModifier,
  cost: 10,
  targetClass: UpgradeTargetID.Player,
  fieldInTargetClass: UpgradeStatID.HealCooldown,
  value: -0.04,
  isMultiplier: true,
  stackable: true,
  maxStacks: 5,
  dependentOn: [{ ids: ["heal_ability"] }],
}

export class HealCooldown1 extends Upgrade {}
