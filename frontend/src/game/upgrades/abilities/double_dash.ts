import { Upgrade, type UpgradeDef, type UpgradeContext } from '../Upgrade'
import { RarityID, UpgradeTypeID } from '../../data/ID'

export const DoubleDashDef: UpgradeDef = {
  id: "double_dash",
  name: "Double Dash",
  description: "Store 2 dashes.",
  rarity: RarityID.Epic,
  upgradeType: UpgradeTypeID.Ability,
  cost: 20,
  effect: "double_dash",
  stackable: false,
  dependentOn: [{ ids: ["dash_ability"] }],
}

export class DoubleDash extends Upgrade {
  onApply(ctx: UpgradeContext): void {
    super.onApply(ctx)
    ctx.player?.setMaxDashCharges(2)
  }
}
