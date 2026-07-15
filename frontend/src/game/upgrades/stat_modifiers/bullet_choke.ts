import { Upgrade, type UpgradeDef } from '../Upgrade'
import type { Projectile } from '../../entities/projectiles/Projectile'
import { BuckshotBullet } from '../../entities/projectiles/player_projectiles/Bullet'
import { UpgradeTargetID, UpgradeStatID, RarityID, UpgradeTypeID, AttackTypeID, UpgradeVariantID } from '../../data/ID'

export const BulletChokeDef: UpgradeDef = {
  id: "bullet_choke",
  name: "Bullet Choke",
  description: "-2 buckshot bullet spread",
  rarity: RarityID.Epic,
  upgradeType: UpgradeTypeID.StatModifier,
  cost: 20,
  targetClass: UpgradeTargetID.Bullet,
  fieldInTargetClass: UpgradeStatID.ChokeAngle,
  value: -2,
  isMultiplier: false,
  specificAttackType: AttackTypeID.Bullet,
  stackable: true,
  maxStacks: 5,
  dependentOn: [{ ids: [UpgradeVariantID.BuckshotBullets] }],
}

export class BulletChoke extends Upgrade {
  // Stat fields in the def are UI/backend metadata only — the behavior is the
  // hook below, so the default modifier-channel application is skipped.
  onApply(): void {}

  modifyProjectileSpawn(projectile: Projectile): void {
    if (projectile instanceof BuckshotBullet) projectile.chokeAngle += this.def.value!
  }
}