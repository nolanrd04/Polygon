import { Upgrade, type UpgradeDef } from '../Upgrade'
import { UpgradeTargetID, UpgradeStatID, RarityID, UpgradeTypeID } from '../../data/ID'

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
}

export class PolygonUpgrade extends Upgrade {}
