import { Upgrade, type UpgradeDef, type DamageRef } from '../Upgrade'
import { RarityID, UpgradeTypeID } from '../../data/ID'

export const Armor2Def: UpgradeDef = {
  id: "armor_2",
  name: "Hardened Shell",
  description: "Reduce incoming damage by 6%",
  rarity: RarityID.Epic,
  upgradeType: UpgradeTypeID.Effect,
  cost: 20,
  effect: "protection",
  effectValue: 0.06,
  stackable: true,
  maxStacks: 4,
}

export class Armor2 extends Upgrade {
  onApply(): void {}

  modifyPlayerHurt(damage: DamageRef): void {
    // Always let at least 1 damage through
    damage.amount = Math.max(1, damage.amount * (1 - this.def.effectValue!))
  }
}
