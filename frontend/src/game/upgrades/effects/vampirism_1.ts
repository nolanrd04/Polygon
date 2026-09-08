import { Upgrade, type UpgradeDef } from '../Upgrade'
import { GameManager } from '../../core/GameManager'
import type { Projectile } from '../../entities/projectiles/Projectile'
import type { Enemy } from '../../entities/enemies/Enemy'
import { RarityID, UpgradeTypeID } from '../../data/ID'

export const Vampirism1Def: UpgradeDef = {
  id: "vampirism_1",
  name: "Vampirism",
  description: "5% chance to heal for 3% of damage dealt. Upgrade to increase chance.",
  rarity: RarityID.Rare,
  upgradeType: UpgradeTypeID.Effect,
  cost: 10,
  effect: "lifesteal",
  effectValue: 0.05,
  stackable: true,
  maxStacks: 5,
}

export class Vampirism1 extends Upgrade {
  onApply(): void {}

  onHitEnemy(_projectile: Projectile, _enemy: Enemy, damageDealt: number): void {
    if (Math.random() < this.def.effectValue!)
    {
      GameManager.heal(damageDealt * 0.03)
    }
  }
}
