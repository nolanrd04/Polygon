import { Upgrade, type UpgradeDef, type ExplosionSpec } from '../Upgrade'
import { UpgradeTargetID, UpgradeStatID, RarityID, UpgradeTypeID } from '../../data/ID'

export const ExplosionDamagePercent1Def: UpgradeDef = {
  id: "explosion_damage_percent_1",
  name: "Explosive Force",
  description: "+3% explosion damage",
  rarity: RarityID.Epic,
  upgradeType: UpgradeTypeID.StatModifier,
  cost: 20,
  targetClass: UpgradeTargetID.Bullet,
  fieldInTargetClass: UpgradeStatID.ExplosionDamage,
  value: 0.03,
  isMultiplier: true,
  specificAttackType: "bullet",
  stackable: true,
  maxStacks: 5,
  dependentOn: ["explosive_bullets", "explosion_on_kill"],
  dependencyCount: 1,
}

export class ExplosionDamagePercent1 extends Upgrade {
  // Stat fields in the def are UI/backend metadata only — the behavior is the
  // hook below, so the default modifier-channel application is skipped.
  onApply(): void {}

  modifyExplosion(explosion: ExplosionSpec): void {
    explosion.damage *= 1 + this.def.value!
  }
}
