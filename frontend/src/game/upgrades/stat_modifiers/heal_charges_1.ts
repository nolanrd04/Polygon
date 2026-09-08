import { Upgrade, type UpgradeDef, type UpgradeContext } from '../Upgrade'
import { RarityID, UpgradeTypeID } from '../../data/ID'

export const HealCharges1Def: UpgradeDef = {
  id: "heal_charges_1",
  name: "Heal Charges",
  description: "Store one more heal.",
  rarity: RarityID.Epic,
  upgradeType: UpgradeTypeID.StatModifier,
  cost: 20,
  effect: "heal_charges",
  stackable: true,
  maxStacks: 9,
  dependentOn: [{ ids: ["heal_ability"] }],
}

export class HealCharges1 extends Upgrade {
  onApply(ctx: UpgradeContext): void {
    super.onApply(ctx)
    // Relative, not absolute: replay re-applies every owned stack in order,
    // so two stacks compound to +2 without a per-tier upgrade.
    ctx.abilities?.addCharges('heal_ability', 1)
  }
}
