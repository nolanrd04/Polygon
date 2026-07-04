import { Upgrade, type UpgradeDef } from '../Upgrade'
import { GameManager } from '../../core/GameManager'
import type { Projectile } from '../../entities/projectiles/Projectile'
import type { Enemy } from '../../entities/enemies/Enemy'
import { RarityID, UpgradeTypeID } from '../../data/ID'

export const Vampirism3Def: UpgradeDef = {
  id: "vampirism_3",
  name: "Vampirism",
  description: "Heal for 12% of damage dealt",
  rarity: RarityID.Legendary,
  upgradeType: UpgradeTypeID.Effect,
  cost: 40,
  effect: "lifesteal",
  effectValue: 0.12,
  stackable: false,
  maxStacks: 1,
  tier: 3,
}

export class Vampirism3 extends Upgrade {
  onApply(): void {}

  onHitEnemy(_projectile: Projectile, _enemy: Enemy, damageDealt: number): void {
    GameManager.heal(damageDealt * this.def.effectValue!)
  }
}
