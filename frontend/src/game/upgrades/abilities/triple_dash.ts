import { Upgrade, type UpgradeDef, type UpgradeContext } from '../Upgrade'
import { RarityID, UpgradeTypeID } from '../../data/ID'

export const TripleDashDef: UpgradeDef = {
  id: "triple_dash",
  name: "Triple Dash",
  description: "Store 3 dashes.",
  rarity: RarityID.Legendary,
  upgradeType: UpgradeTypeID.Ability,
  cost: 40,
  effect: "triple_dash",
  stackable: false,
  dependentOn: [{ ids: ["double_dash"] }],
}

export class TripleDash extends Upgrade {
  onApply(ctx: UpgradeContext): void {
    super.onApply(ctx)
    ctx.player?.setMaxDashCharges(3)
  }
}
