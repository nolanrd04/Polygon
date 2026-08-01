import { Upgrade, type UpgradeDef, type DamageRef } from '../Upgrade'
import { RarityID, UpgradeTypeID } from '../../data/ID'

export const ArmorDef: UpgradeDef = {
  id: "armor",
  name: "Hardened Shell",
  description: "Reduce incoming damage by 2.5%",
  rarity: RarityID.Rare,
  upgradeType: UpgradeTypeID.Effect,
  cost: 10,
  effect: "protection",
  effectValue: 0.025,
  stackable: true,
  maxStacks: 7,
}

export class Armor extends Upgrade {
  onApply(): void {}

  modifyPlayerHurt(damage: DamageRef): void {
    // Always let at least 1 damage through
    damage.amount = Math.max(1, damage.amount * (1 - this.def.effectValue!))
  }
}
