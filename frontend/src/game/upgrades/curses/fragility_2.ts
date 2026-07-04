import { Upgrade, type UpgradeDef, type DamageRef } from '../Upgrade'
import { RarityID, UpgradeTypeID } from '../../data/ID'

export const Fragility2Def: UpgradeDef = {
  id: "fragility_2",
  name: "Fragility 2",
  description: "Increased damage taken by 3.5%",
  rarity: RarityID.Epic,
  upgradeType: UpgradeTypeID.Effect,
  cost: 0,
  value: 0.035,
  isMultiplier: true,
  effect: "protection",
  stackable: true,
  maxStacks: 1,
  curse: true,
}

export class Fragility2 extends Upgrade {
  onApply(): void {}

  modifyPlayerHurt(damage: DamageRef): void {
    damage.amount *= 1 + this.def.value!
  }
}
