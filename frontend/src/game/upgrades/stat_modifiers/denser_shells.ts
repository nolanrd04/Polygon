import { Upgrade, type UpgradeDef } from '../Upgrade'
import type { Projectile } from '../../entities/projectiles/Projectile'
import { BuckshotBullet } from '../../entities/projectiles/player_projectiles/Bullet'
import { UpgradeTargetID, UpgradeStatID, RarityID, UpgradeTypeID, AttackTypeID, UpgradeVariantID } from '../../data/ID'

export const DenserShellsDef: UpgradeDef = {
  id: "denser_shells",
  name: "Denser Shells",
  description: "+1 maximum buckshot pellets",
  rarity: RarityID.Legendary,
  upgradeType: UpgradeTypeID.StatModifier,
  cost: 40,
  targetClass: UpgradeTargetID.Bullet,
  fieldInTargetClass: UpgradeStatID.MaximumPellets,
  value: 1,
  isMultiplier: false,
  specificAttackType: AttackTypeID.Bullet,
  stackable: true,
  maxStacks: 2,
  dependentOn: [{ ids: [UpgradeVariantID.BuckshotBullets] }],
}

export class DenserShells extends Upgrade {
  // Stat fields in the def are UI/backend metadata only — the behavior is the
  // hook below, so the default modifier-channel application is skipped.
  onApply(): void {}

  modifyProjectileSpawn(projectile: Projectile): void {
    if (projectile instanceof BuckshotBullet) projectile.maxPellets += this.def.value!
  }
}