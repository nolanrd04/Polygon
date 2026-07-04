import { Upgrade, type UpgradeDef, type ExplosionSpec } from '../Upgrade'
import { UpgradeTargetID, UpgradeStatID, RarityID, UpgradeTypeID } from '../../data/ID'

export const ExplosionRadiusDef: UpgradeDef = {
  id: "explosion_radius",
  name: "Blast Radius",
  description: "+5 explosion radius",
  rarity: RarityID.Uncommon,
  upgradeType: UpgradeTypeID.StatModifier,
  cost: 6,
  targetClass: UpgradeTargetID.Bullet,
  fieldInTargetClass: UpgradeStatID.ExplosionRadius,
  value: 5,
  specificAttackType: "bullet",
  stackable: true,
  maxStacks: 5,
  dependentOn: ["explosive_bullets", "explosion_on_kill"],
  dependencyCount: 1,
}

export class ExplosionRadius extends Upgrade {
  // Stat fields in the def are UI/backend metadata only — the behavior is the
  // hook below, so the default modifier-channel application is skipped.
  onApply(): void {}

  modifyExplosion(explosion: ExplosionSpec): void {
    explosion.radius += this.def.value!
  }
}
