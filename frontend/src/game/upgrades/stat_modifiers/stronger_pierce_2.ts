import { Upgrade, type UpgradeDef } from '../Upgrade'
import type { Projectile } from '../../entities/projectiles/Projectile'
import { HomingBullet } from '../../entities/projectiles/player_projectiles/Bullet'
import { UpgradeTargetID, UpgradeStatID, RarityID, UpgradeTypeID } from '../../data/ID'

export const StrongerPierce2Def: UpgradeDef = {
  id: "stronger_pierce_2",
  name: "Stronger Pierce 2",
  description: "Decreases the damage reduction of homing bullets after hitting an enemy by 5%",
  rarity: RarityID.Epic,
  upgradeType: UpgradeTypeID.StatModifier,
  cost: 20,
  targetClass: UpgradeTargetID.Bullet,
  fieldInTargetClass: UpgradeStatID.HitEnemyDamageReduction,
  value: -0.05,
  specificAttackType: "bullet",
  stackable: true,
  maxStacks: 1,
  dependentOn: [{ ids: ["homing_bullets"] }],
}

export class StrongerPierce2 extends Upgrade {
  // Stat fields in the def are UI/backend metadata only — the behavior is the
  // hook below, so the default modifier-channel application is skipped.
  onApply(): void {}

  modifyProjectileSpawn(projectile: Projectile): void {
    if (projectile instanceof HomingBullet) projectile.minimumDamageMultiplier += this.def.value!
  }
}
