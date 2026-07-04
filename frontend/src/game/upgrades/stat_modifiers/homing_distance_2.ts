import { Upgrade, type UpgradeDef } from '../Upgrade'
import type { Projectile } from '../../entities/projectiles/Projectile'
import { HomingBullet } from '../../entities/projectiles/player_projectiles/Bullet'
import { UpgradeTargetID, UpgradeStatID, RarityID, UpgradeTypeID } from '../../data/ID'

export const HomingDistance2Def: UpgradeDef = {
  id: "homing_distance_2",
  name: "Enhanced Eyesight",
  description: "+50 tracking distance for homing bullets",
  rarity: RarityID.Rare,
  upgradeType: UpgradeTypeID.StatModifier,
  cost: 10,
  targetClass: UpgradeTargetID.Bullet,
  fieldInTargetClass: UpgradeStatID.TrackingDistance,
  value: 50,
  specificAttackType: "bullet",
  stackable: true,
  maxStacks: 4,
  dependentOn: ["homing_bullets"],
  dependencyCount: 1,
}

export class HomingDistance2 extends Upgrade {
  // Stat fields in the def are UI/backend metadata only — the behavior is the
  // hook below, so the default modifier-channel application is skipped.
  onApply(): void {}

  modifyProjectileSpawn(projectile: Projectile): void {
    if (projectile instanceof HomingBullet) projectile.trackingDistance += this.def.value!
  }
}
