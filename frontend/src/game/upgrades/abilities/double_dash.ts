import { Upgrade, type UpgradeDef, type UpgradeContext } from '../Upgrade'
import { IconID, RarityID, UpgradeTypeID } from '../../data/ID'

export const DoubleDashDef: UpgradeDef = {
  id: "double_dash",
  name: "Double Dash",
  description: "Store 2 dashes.",
  rarity: RarityID.Epic,
  upgradeType: UpgradeTypeID.Ability,
  cost: 20,
  effect: "double_dash",
  stackable: false,
  tier: 2,
  dependentOn: [
    { ids: [{id: "dash_ability", minStacks: 1}] },
    { ids: [{id: "polygon_upgrade", minStacks: 2}] },
  ],
  upgradesTo: "triple_dash",
  icon: IconID.Dash,
}

export class DoubleDash extends Upgrade {
  onApply(ctx: UpgradeContext): void {
    super.onApply(ctx)
    ctx.abilities?.setCharges('dash_ability', 2)
  }
}
