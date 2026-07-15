import { Upgrade, type UpgradeDef, type ExplosionSpec } from '../Upgrade'
import { UpgradeTargetID, UpgradeStatID, RarityID, UpgradeTypeID } from '../../data/ID'

export const ExplosionDamage1Def: UpgradeDef = {
  id: "explosion_damage_1",
  name: "Volatile Core",
  description: "+5 explosion damage",
  rarity: RarityID.Rare,
  upgradeType: UpgradeTypeID.StatModifier,
  cost: 10,
  targetClass: UpgradeTargetID.Bullet,
  fieldInTargetClass: UpgradeStatID.ExplosionDamage,
  value: 5,
  isMultiplier: false,
  specificAttackType: "bullet",
  stackable: true,
  maxStacks: 99999,
  dependentOn: [{ ids: ["explosive_bullets", "explosion_on_kill"] }],
}

export class ExplosionDamage1 extends Upgrade {
  // Stat fields in the def are UI/backend metadata only — the behavior is the
  // hook below, so the default modifier-channel application is skipped.
  onApply(): void {}

  modifyExplosion(explosion: ExplosionSpec): void {
    explosion.damage += this.def.value!
  }
}
