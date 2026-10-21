import { Upgrade, type UpgradeDef } from '../Upgrade'
import { GameManager } from '../../core/GameManager'
import type { Projectile } from '../../entities/projectiles/Projectile'
import type { Enemy } from '../../entities/enemies/Enemy'
import { IconID, RarityID, UpgradeTypeID } from '../../data/ID'

export const Vampirism3Def: UpgradeDef = {
  id: "vampirism_3",
  name: "Vampirism III",
  description: "5% chance to heal for 15% of damage dealt. Upgrade to increase chance.",
  rarity: RarityID.Legendary,
  upgradeType: UpgradeTypeID.Effect,
  cost: 40,
  effect: "lifesteal",
  effectValue: 0.05,
  stackable: false,
  maxStacks: 2,
  icon: IconID.Vampire,
  tier: 3,
  dependentOn: [
    { ids: [{id: "vampirism_2", minStacks: 1}] },
    { ids: [{id: "polygon_upgrade", minStacks: 3}] },
  ]
}

export class Vampirism3 extends Upgrade {
  onApply(): void {}

  onHitEnemy(_projectile: Projectile, _enemy: Enemy, damageDealt: number): void {
    if (Math.random() < this.def.effectValue!)
    {
      GameManager.heal(damageDealt * 0.15)
    }
  }
}
