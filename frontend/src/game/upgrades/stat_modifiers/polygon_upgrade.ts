import { Upgrade, type UpgradeDef } from '../Upgrade'
import { UpgradeTargetID, UpgradeStatID, RarityID, UpgradeTypeID, IconID } from '../../data/ID'

export const PolygonUpgradeDef: UpgradeDef = {
  id: "polygon_upgrade",
  name: "Evolution",
  description: "+1 polygon side",
  rarity: RarityID.Legendary,
  upgradeType: UpgradeTypeID.StatModifier,
  cost: 60,
  targetClass: UpgradeTargetID.Player,
  fieldInTargetClass: UpgradeStatID.PolygonSides,
  value: 1,
  stackable: true,
  maxStacks: 9,
  icon: IconID.Infinity,
}

export class PolygonUpgrade extends Upgrade {}
