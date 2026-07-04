import { Upgrade, type UpgradeDef } from '../Upgrade'
import { RarityID, UpgradeTypeID } from '../../data/ID'

export const RicochetDef: UpgradeDef = {
  id: "ricochet",
  name: "Ricochet Rounds",
  description: "Projectiles bounce off surfaces.",
  rarity: RarityID.Epic,
  upgradeType: UpgradeTypeID.Effect,
  cost: 20,
  effect: "ricochet",
  effectValue: 1,
  stackable: true,
  maxStacks: 2,
  dependentOn: ["bullet_pierce_1"],
  dependencyCount: 1,
  incompatibleWith: ["homing_bullets"],
}

export class Ricochet extends Upgrade {}
