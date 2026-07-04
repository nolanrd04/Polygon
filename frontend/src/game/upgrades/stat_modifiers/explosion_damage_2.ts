import { Upgrade, type UpgradeDef, type ExplosionSpec } from '../Upgrade'
import { UpgradeTargetID, UpgradeStatID, RarityID, UpgradeTypeID } from '../../data/ID'

export const ExplosionDamage2Def: UpgradeDef = {
  id: "explosion_damage_2",
  name: "Volatile Core",
  description: "+11 explosion damage",
  rarity: RarityID.Epic,
  upgradeType: UpgradeTypeID.StatModifier,
  cost: 20,
  targetClass: UpgradeTargetID.Bullet,
  fieldInTargetClass: UpgradeStatID.ExplosionDamage,
  value: 11,
  isMultiplier: false,
  specificAttackType: "bullet",
  stackable: true,
  maxStacks: 99999,
  dependentOn: ["explosive_bullets", "explosion_on_kill"],
  dependencyCount: 1,
}

export class ExplosionDamage2 extends Upgrade {
  // Stat fields in the def are UI/backend metadata only — the behavior is the
  // hook below, so the default modifier-channel application is skipped.
  onApply(): void {}

  modifyExplosion(explosion: ExplosionSpec): void {
    explosion.damage += this.def.value!
  }
}
