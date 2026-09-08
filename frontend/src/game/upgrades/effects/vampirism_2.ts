import { Upgrade, type UpgradeDef } from '../Upgrade'
import { GameManager } from '../../core/GameManager'
import type { Projectile } from '../../entities/projectiles/Projectile'
import type { Enemy } from '../../entities/enemies/Enemy'
import { RarityID, UpgradeTypeID } from '../../data/ID'

export const Vampirism2Def: UpgradeDef = {
  id: "vampirism_2",
  name: "Vampirism",
  description: "5% chance to heal for 10% of damage dealt. Upgrade to increase chance.",
  rarity: RarityID.Epic,
  upgradeType: UpgradeTypeID.Effect,
  cost: 20,
  effect: "lifesteal",
  effectValue: 0.05,
  stackable: false,
  maxStacks: 3,
}

export class Vampirism2 extends Upgrade {
  onApply(): void {}

  onHitEnemy(_projectile: Projectile, _enemy: Enemy, damageDealt: number): void {
    if (Math.random() < this.def.effectValue!)
    {
      GameManager.heal(damageDealt * 0.1)
    }
  }
}
