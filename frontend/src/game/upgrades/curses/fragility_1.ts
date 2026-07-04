import { Upgrade, type UpgradeDef, type DamageRef } from '../Upgrade'
import { RarityID, UpgradeTypeID } from '../../data/ID'

export const Fragility1Def: UpgradeDef = {
  id: "fragility_1",
  name: "Fragility 1",
  description: "Increased damage taken by 1.25%",
  rarity: RarityID.Rare,
  upgradeType: UpgradeTypeID.Effect,
  cost: 0,
  value: 0.0125,
  isMultiplier: true,
  effect: "protection",
  stackable: true,
  maxStacks: 3,
  curse: true,
}

export class Fragility1 extends Upgrade {
  onApply(): void {}

  modifyPlayerHurt(damage: DamageRef): void {
    damage.amount *= 1 + this.def.value!
  }
}
