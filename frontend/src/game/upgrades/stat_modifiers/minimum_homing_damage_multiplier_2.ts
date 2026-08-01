import { Upgrade, type UpgradeDef } from '../Upgrade'
import type { Projectile } from '../../entities/projectiles/Projectile'
import { HomingBullet } from '../../entities/projectiles/player_projectiles/Bullet'
import { UpgradeTargetID, UpgradeStatID, RarityID, UpgradeTypeID } from '../../data/ID'

export const MinimumHomingDamageMultiplier2Def: UpgradeDef = {
  id: "minimum_homing_damage_multiplier_2",
  name: "Kinetic Amplifier",
  description: "Increases the minimum possible damage of homing bullets by 3%",
  rarity: RarityID.Legendary,
  upgradeType: UpgradeTypeID.StatModifier,
  cost: 40,
  targetClass: UpgradeTargetID.Bullet,
  fieldInTargetClass: UpgradeStatID.MinimumDamageMultiplier,
  value: 0.03,
  specificAttackType: "bullet",
  stackable: true,
  maxStacks: 2,
  dependentOn: [{ ids: ["homing_bullets"] }],
}

export class MinimumHomingDamageMultiplier2 extends Upgrade {
  // Stat fields in the def are UI/backend metadata only — the behavior is the
  // hook below, so the default modifier-channel application is skipped.
  onApply(): void {}

  modifyProjectileSpawn(projectile: Projectile): void {
    if (projectile instanceof HomingBullet) projectile.minimumDamageMultiplier += this.def.value!
  }
}
