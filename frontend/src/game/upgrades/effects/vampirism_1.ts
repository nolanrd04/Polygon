import { Upgrade, type UpgradeDef } from '../Upgrade'
import { GameManager } from '../../core/GameManager'
import type { Projectile } from '../../entities/projectiles/Projectile'
import type { Enemy } from '../../entities/enemies/Enemy'
import { RarityID, UpgradeTypeID } from '../../data/ID'

export const Vampirism1Def: UpgradeDef = {
  id: "vampirism_1",
  name: "Vampirism",
  description: "Heal for 2% of damage dealt",
  rarity: RarityID.Rare,
  upgradeType: UpgradeTypeID.Effect,
  cost: 10,
  effect: "lifesteal",
  effectValue: 0.02,
  stackable: false,
  maxStacks: 1,
  tier: 1,
  upgradesTo: "vampirism_2",
}

export class Vampirism1 extends Upgrade {
  onApply(): void {}

  onHitEnemy(_projectile: Projectile, _enemy: Enemy, damageDealt: number): void {
    GameManager.heal(damageDealt * this.def.effectValue!)
  }
}
