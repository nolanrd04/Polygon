import { Upgrade, type UpgradeDef } from '../Upgrade'
import { GameManager } from '../../core/GameManager'
import type { Projectile } from '../../entities/projectiles/Projectile'
import type { Enemy } from '../../entities/enemies/Enemy'
import { IconID, RarityID, UpgradeTypeID } from '../../data/ID'

export const Vampirism2Def: UpgradeDef = {
  id: "vampirism_2",
  name: "Vampirism II",
  description: "5% chance to heal for 5% of damage dealt. Upgrade to increase chance.",
  rarity: RarityID.Epic,
  upgradeType: UpgradeTypeID.Effect,
  cost: 20,
  effect: "lifesteal",
  effectValue: 0.05,
  stackable: false,
  maxStacks: 3,
  icon: IconID.Vampire,
  tier: 2,
  upgradesTo: "vampirism_3",
  dependentOn: [
    { ids: [{id: "vampirism_1", minStacks: 3}] },
    { ids: [{id: "polygon_upgrade", minStacks: 2}] },
  ]
}

export class Vampirism2 extends Upgrade {
  onApply(): void {}

  onHitEnemy(_projectile: Projectile, _enemy: Enemy, damageDealt: number): void {
    if (Math.random() < this.def.effectValue!)
    {
      GameManager.heal(damageDealt * 0.05)
    }
  }
}
