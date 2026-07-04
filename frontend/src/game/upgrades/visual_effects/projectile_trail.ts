import { Upgrade, type UpgradeDef } from '../Upgrade'
import { UpgradeTargetID, RarityID, UpgradeTypeID } from '../../data/ID'

export const ProjectileTrailDef: UpgradeDef = {
  id: "projectile_trail",
  name: "Particle Trail",
  description: "Projectiles leave trails",
  rarity: RarityID.Common,
  upgradeType: UpgradeTypeID.VisualEffect,
  cost: 0,
  targetClass: UpgradeTargetID.Bullet,
  effect: "trail",
  stackable: false,
}

export class ProjectileTrail extends Upgrade {}
