import { Upgrade, type UpgradeDef, type DamageRef } from '../Upgrade'
import type { Enemy } from '../../entities/enemies/Enemy'
import { RarityID, UpgradeTypeID } from '../../data/ID'

export const ThornsDef: UpgradeDef = {
  id: "thorns",
  name: "Thorns",
  description: "Reflect 10% of damage taken",
  rarity: RarityID.Epic,
  upgradeType: UpgradeTypeID.Effect,
  cost: 20,
  effect: "thorns",
  effectValue: 0.1,
  stackable: true,
  maxStacks: 3,
}

export class Thorns extends Upgrade {
  onApply(): void {}

  modifyPlayerHurt(damage: DamageRef, source?: Enemy): void {
    // Reflect only on direct enemy contact — projectile hits carry no source
    if (source) source.takeDamage(damage.amount * this.def.effectValue!)
  }
}
