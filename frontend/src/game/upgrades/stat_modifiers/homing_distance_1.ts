import { Upgrade, type UpgradeDef } from '../Upgrade'
import type { Projectile } from '../../entities/projectiles/Projectile'
import { HomingBullet } from '../../entities/projectiles/player_projectiles/Bullet'
import { UpgradeTargetID, UpgradeStatID, RarityID, UpgradeTypeID } from '../../data/ID'

export const HomingDistance1Def: UpgradeDef = {
  id: "homing_distance_1",
  name: "Enhanced Eyesight",
  description: "+20 tracking distance for homing bullets",
  rarity: RarityID.Uncommon,
  upgradeType: UpgradeTypeID.StatModifier,
  cost: 6,
  targetClass: UpgradeTargetID.Bullet,
  fieldInTargetClass: UpgradeStatID.TrackingDistance,
  value: 20,
  specificAttackType: "bullet",
  stackable: true,
  maxStacks: 6,
  dependentOn: ["homing_bullets"],
  dependencyCount: 1,
}

export class HomingDistance1 extends Upgrade {
  // Stat fields in the def are UI/backend metadata only — the behavior is the
  // hook below, so the default modifier-channel application is skipped.
  onApply(): void {}

  modifyProjectileSpawn(projectile: Projectile): void {
    if (projectile instanceof HomingBullet) projectile.trackingDistance += this.def.value!
  }
}
