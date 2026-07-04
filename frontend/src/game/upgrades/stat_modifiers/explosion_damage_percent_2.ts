import { Upgrade, type UpgradeDef, type ExplosionSpec } from '../Upgrade'
import { UpgradeTargetID, UpgradeStatID, RarityID, UpgradeTypeID } from '../../data/ID'

export const ExplosionDamagePercent2Def: UpgradeDef = {
  id: "explosion_damage_percent_2",
  name: "Explosive Force",
  description: "+7% explosion damage",
  rarity: RarityID.Legendary,
  upgradeType: UpgradeTypeID.StatModifier,
  cost: 40,
  targetClass: UpgradeTargetID.Bullet,
  fieldInTargetClass: UpgradeStatID.ExplosionDamage,
  value: 0.07,
  isMultiplier: true,
  specificAttackType: "bullet",
  stackable: true,
  maxStacks: 3,
  dependentOn: ["explosive_bullets", "explosion_on_kill"],
  dependencyCount: 1,
}

export class ExplosionDamagePercent2 extends Upgrade {
  // Stat fields in the def are UI/backend metadata only — the behavior is the
  // hook below, so the default modifier-channel application is skipped.
  onApply(): void {}

  modifyExplosion(explosion: ExplosionSpec): void {
    explosion.damage *= 1 + this.def.value!
  }
}
