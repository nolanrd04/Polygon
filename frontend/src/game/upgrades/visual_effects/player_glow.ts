import { Upgrade, type UpgradeDef } from '../Upgrade'
import { UpgradeTargetID, RarityID, UpgradeTypeID } from '../../data/ID'

// Note: color/intensity from the original JSON entry are dropped here — confirmed
// (via grep across the frontend) that no rendering code reads hasVisualEffect()/
// getVisualEffect() today, so this upgrade is already purely decorative/inert.
export const PlayerGlowDef: UpgradeDef = {
  id: "player_glow",
  name: "Radiant Core",
  description: "Player emits a glowing aura",
  rarity: RarityID.Uncommon,
  upgradeType: UpgradeTypeID.VisualEffect,
  cost: 0,
  targetClass: UpgradeTargetID.Player,
  effect: "glow",
  stackable: false,
}

export class PlayerGlow extends Upgrade {}
