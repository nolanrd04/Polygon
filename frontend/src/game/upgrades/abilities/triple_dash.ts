import { Upgrade, type UpgradeDef, type UpgradeContext } from '../Upgrade'
import { RarityID, UpgradeTypeID } from '../../data/ID'
import { IconID } from '../../data/ID'

export const TripleDashDef: UpgradeDef = {
  id: "triple_dash",
  name: "Triple Dash",
  description: "Store 3 dashes.",
  rarity: RarityID.Legendary,
  upgradeType: UpgradeTypeID.Ability,
  cost: 40,
  effect: "triple_dash",
  stackable: false,
  tier: 3,
  dependentOn: [
    { ids: [{id: "double_dash", minStacks: 1}] },
    { ids: [{id: "polygon_upgrade", minStacks: 4}] },
  ],
  icon: IconID.Dash,
}

export class TripleDash extends Upgrade {
  onApply(ctx: UpgradeContext): void {
    super.onApply(ctx)
    ctx.abilities?.setCharges('dash_ability', 3)
  }
}
