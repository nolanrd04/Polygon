import { Upgrade, type UpgradeDef, type ExplosionSpec } from '../Upgrade'
import { UpgradeTargetID, UpgradeStatID, RarityID, UpgradeTypeID } from '../../data/ID'

export const ExplosionDamage3Def: UpgradeDef = {
  id: "explosion_damage_3",
  name: "Volatile Core",
  description: "+25 explosion damage",
  rarity: RarityID.Legendary,
  upgradeType: UpgradeTypeID.StatModifier,
  cost: 40,
  targetClass: UpgradeTargetID.Bullet,
  fieldInTargetClass: UpgradeStatID.ExplosionDamage,
  value: 25,
  isMultiplier: false,
  specificAttackType: "bullet",
  stackable: true,
  maxStacks: 99999,
  dependentOn: [{ ids: ["explosive_bullets", "explosion_on_kill"] }],
}

export class ExplosionDamage3 extends Upgrade {
  // Stat fields in the def are UI/backend metadata only — the behavior is the
  // hook below, so the default modifier-channel application is skipped.
  onApply(): void {}

  modifyExplosion(explosion: ExplosionSpec): void {
    explosion.damage += this.def.value!
  }
}
