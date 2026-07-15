import { Upgrade, type UpgradeDef } from '../Upgrade'
import type { Projectile } from '../../entities/projectiles/Projectile'
import { BuckshotBullet } from '../../entities/projectiles/player_projectiles/Bullet'
import { UpgradeTargetID, UpgradeStatID, RarityID, UpgradeTypeID, AttackTypeID, UpgradeVariantID } from '../../data/ID'

export const LongerShellsDef: UpgradeDef = {
  id: "longer_shells",
  name: "Longer Shells",
  description: "+1 minimum buckshot pellets",
  rarity: RarityID.Legendary,
  upgradeType: UpgradeTypeID.StatModifier,
  cost: 40,
  targetClass: UpgradeTargetID.Bullet,
  fieldInTargetClass: UpgradeStatID.MinimumPellets,
  value: 1,
  isMultiplier: false,
  specificAttackType: AttackTypeID.Bullet,
  stackable: true,
  maxStacks: 2,
  dependentOn: [{ ids: [UpgradeVariantID.BuckshotBullets] }],
}

export class LongerShells extends Upgrade {
  // Stat fields in the def are UI/backend metadata only — the behavior is the
  // hook below, so the default modifier-channel application is skipped.
  onApply(): void {}

  modifyProjectileSpawn(projectile: Projectile): void {
    if (projectile instanceof BuckshotBullet) projectile.minPellets += this.def.value!
  }
}