import { Upgrade, type UpgradeDef } from '../Upgrade'
import { RarityID, UpgradeTypeID } from '../../data/ID'

// Ricochet bounce logic is handled in the projectile classes this upgrade
// applies to, not here - each checks
// UpgradeEffectSystem.hasEffect(UpgradeEffectID.Ricochet) in its own
// OnObstacleCollide() override. See Bullet.ts (Bullet, ExplosiveBullet,
// BuckshotPellet).
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
  dependentOn: [{ ids: ["bullet_pierce_1"] }],
  incompatibleWith: ["homing_bullets"],
}

export class Ricochet extends Upgrade {}
